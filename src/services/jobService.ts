import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq, and, desc } from 'drizzle-orm';
import { SourceRegistry } from './sources/registry.ts';
import { LeadService } from './leadService.ts';
import { GridPartitionService, BoundingBox } from './gridPartitionService.ts';
import { IdentityService } from './identityService.ts';
import { EnrichmentBot } from './enrichmentBot.ts';
import { SearchProviderFactory } from './search/types.ts';
import { WebsiteService } from './websiteService.ts';
import { OpportunityService } from './opportunityService.ts';
import { SocialEnrichmentService } from './socialEnrichmentService.ts';
import { logger, metrics } from '../lib/monitoring.ts';

export class JobService {
  static async createJob(userId: number, type: string, total: number) {
    const [job] = await db.insert(schema.jobs).values({
      userId,
      type,
      total,
      status: 'queued',
      progress: 0,
      results: {
        target: total,
        totalFound: 0,
        validBusinesses: 0,
        duplicates: 0,
        chainsFiltered: 0,
        websiteCandidates: 0,
        verifiedWebsites: 0,
        phonesFound: 0,
        emailsFound: 0,
        pagesCrawled: 0,
        auditsCompleted: 0,
        opportunitiesAnalyzed: 0,
        cellsTotal: 0,
        cellsCompleted: 0,
        newLeadsSaved: 0,
        currentStep: 'Initializing pipeline...',
        currentCell: 'Pending'
      }
    }).returning();
    return job;
  }

  static async updateJobProgress(jobId: number, progress: number, status: string = 'running', results?: any) {
    const updateData: any = { progress, status, updatedAt: new Date() };
    if (results) updateData.results = results;
    await db.update(schema.jobs).set(updateData).where(eq(schema.jobs.id, jobId));
  }

  static async failJob(jobId: number, error: string) {
    await db.update(schema.jobs)
      .set({ status: 'failed', error, updatedAt: new Date() })
      .where(eq(schema.jobs.id, jobId));
  }

  static async resumeLeadGeneration(jobId: number, sourceId: string, criteria: any, campaignId?: number) {
    return this.runLeadGeneration(jobId, sourceId, criteria, campaignId, true);
  }

  static async runLeadGeneration(jobId: number, sourceId: string, criteria: any, campaignId?: number, isResume: boolean = false) {
    const startTime = Date.now();
    try {
      const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
      if (!job) return;

      const results = (job.results as any) || {};
      const targetCount = criteria.maxResults || criteria.limit || 50;
      results.target = targetCount;

      let cells: Array<BoundingBox | null> = [];
      const location = `${criteria.city || ''} ${criteria.country || ''}`.trim();
      
      results.currentStep = 'Calculating geographic partitions...';
      await this.updateJobProgress(jobId, results.newLeadsSaved || 0, 'running', results);

      // Phase 1. Geographic Partitioning
      const masterBbox = await GridPartitionService.getBoundingBox(location);
      if (masterBbox) {
        const divisions = GridPartitionService.calculateDivisions(masterBbox, targetCount);
        cells = GridPartitionService.partition(masterBbox, divisions);
      } else {
        // Fallback to single partition without bbox (searches by city/country area name)
        cells = [null];
      }

      results.cellsTotal = cells.length;
      const startCellIdx = isResume ? (results.cellsCompleted || 0) : 0;
      if (!isResume) results.cellsCompleted = 0;
      await this.updateJobProgress(jobId, results.newLeadsSaved || 0, 'running', results);

      const source = SourceRegistry.getSource(sourceId);
      let totalSaved = results.newLeadsSaved || 0;

      // Phase 2. Controlled Cell Discovery
      for (let cellIdx = startCellIdx; cellIdx < cells.length; cellIdx++) {
        if (totalSaved >= targetCount) {
          results.currentStep = `Target reached (${totalSaved}/${targetCount} leads). Finalizing...`;
          break;
        }

        const cell = cells[cellIdx];
        results.currentCell = `${cellIdx + 1}/${cells.length}`;
        results.currentStep = `Searching cell ${results.currentCell} (${location || 'Region'})...`;
        await this.updateJobProgress(jobId, totalSaved, 'running', results);

        try {
          const queryParams: any = { ...criteria, limit: Math.min(targetCount - totalSaved + 20, 100) };
          if (cell) queryParams.bbox = cell;

          const rawLeads = await source.search(queryParams);
          results.totalFound += rawLeads.length;

          if (rawLeads.length > 0 && (rawLeads[0] as any).rawData?.chainsExcludedCount) {
            results.chainsFiltered = (results.chainsFiltered || 0) + (rawLeads[0] as any).rawData.chainsExcludedCount;
          }

          // Controlled batches of 4 for enrichment concurrency
          const BATCH_SIZE = 4;
          for (let b = 0; b < rawLeads.length; b += BATCH_SIZE) {
            if (totalSaved >= targetCount) break;
            const batch = rawLeads.slice(b, b + BATCH_SIZE);

            await Promise.all(batch.map(async (rawLead) => {
              if (totalSaved >= targetCount) return;

              // Phase 3. Normalization & Deduplication
              const { lead, status } = await LeadService.createLead(rawLead, campaignId);

              if (status === 'created') {
                results.validBusinesses++;
                results.newLeadsSaved++;
                totalSaved++;

                // Phase 4. Website Discovery & Deep Contact Enrichment
                // Phase 5. Audit & Opportunity Assessment
                await this.enrichLead(lead, results);
              } else {
                results.duplicates++;
              }
            }));

            await this.updateJobProgress(jobId, totalSaved, 'running', results);
          }

          results.cellsCompleted = cellIdx + 1;
          await this.updateJobProgress(jobId, totalSaved, 'running', results);

          // Polite pacing between cell queries
          if (cellIdx < cells.length - 1 && totalSaved < targetCount) {
            await new Promise(resolve => setTimeout(resolve, 1200));
          }
        } catch (cellErr: any) {
          await logger.error('JOB', `Cell ${cellIdx + 1} query issue: ${cellErr.message}`, cellErr, { jobId, cellIdx });
          results.cellsCompleted = cellIdx + 1;
          await this.updateJobProgress(jobId, totalSaved, 'running', results);
        }
      }

      // Complete
      results.currentStep = `Completed. Discovered ${results.validBusinesses} real leads.`;
      results.currentCell = 'Completed';
      await this.updateJobProgress(jobId, totalSaved, 'completed', results);
      await metrics.record('JOB', 'LEAD_GEN', 'SUCCESS', Date.now() - startTime, { jobId, totalSaved });

    } catch (error: any) {
      console.error('Job execution failed:', error);
      await this.failJob(jobId, error.message);
    }
  }

  private static async enrichLead(lead: any, results: any) {
    try {
      let website = lead.website;
      let websiteSource = lead.source || 'OpenStreetMap';

      // Phase F: Website Discovery if website is NULL
      if (!website) {
        const candidates = await SearchProviderFactory.findWebsites(lead.companyName, lead.city || '');
        if (candidates.length > 0) {
          results.websiteCandidates += candidates.length;

          // Deterministic identity matching against company name & location
          for (const cand of candidates) {
            const score = IdentityService.calculateRelevanceScore(lead.companyName, cand.url, lead.address, lead.city);
            if (score >= 40) {
              website = cand.url;
              websiteSource = cand.source;
              const confidence = IdentityService.getConfidence(score);
              
              await db.update(schema.leads).set({
                website: cand.url,
                websiteCandidate: cand.url,
                websiteStatus: 'verified',
                websiteConfidence: confidence,
                enrichmentSource: cand.source
              }).where(eq(schema.leads.id, lead.id));

              // Record evidence for discovered website
              await db.insert(schema.fieldEvidence).values({
                leadId: lead.id,
                fieldName: 'website',
                value: cand.url,
                source: cand.source,
                sourceUrl: cand.url,
                verified: confidence === 'VERIFIED' || confidence === 'HIGH',
                confidence: confidence === 'VERIFIED' ? 'HIGH' : confidence === 'HIGH' ? 'HIGH' : 'MEDIUM'
              });

              results.verifiedWebsites++;
              break;
            }
          }
        }
        if (!website) {
          await db.update(schema.leads).set({
            websiteStatus: 'not_detected',
            websiteConfidence: 'LOW'
          }).where(eq(schema.leads.id, lead.id));
        }
      } else {
        // Website already provided by OSM - mark as verified candidate
        results.verifiedWebsites++;
      }

      // Phase G: Contact Enrichment via Deep Site Crawl
      if (website && !website.includes('facebook.com') && !website.includes('instagram.com')) {
        const enriched = await EnrichmentBot.enrich(website);
        results.pagesCrawled = (results.pagesCrawled || 0) + 1;

        if (enriched.evidence.length > 0) {
          const evidenceBatch = enriched.evidence.map(e => ({
            leadId: lead.id,
            fieldName: e.field,
            value: e.value,
            source: 'OFFICIAL_WEBSITE',
            sourceUrl: e.url,
            verified: e.confidence === 'HIGH',
            confidence: e.confidence
          }));

          await db.insert(schema.fieldEvidence).values(evidenceBatch);

          const updateObj: any = {
            lastEnrichedAt: new Date(),
            enrichmentSource: 'OFFICIAL_WEBSITE'
          };

          if (!lead.phone && enriched.phone) {
            updateObj.phone = enriched.phone;
            results.phonesFound = (results.phonesFound || 0) + 1;
          }
          if (!lead.email && enriched.email) {
            updateObj.email = enriched.email;
            results.emailsFound = (results.emailsFound || 0) + 1;
          }
          if (!lead.address && enriched.address) {
            updateObj.address = enriched.address;
          }

          const extraNotes: string[] = [];
          if (enriched.whatsapp) extraNotes.push(`WhatsApp: ${enriched.whatsapp}`);
          if (enriched.openingHours) extraNotes.push(`Hours: ${enriched.openingHours}`);
          if (enriched.managerName) extraNotes.push(`Dirigeant/Manager: ${enriched.managerName}`);
          if (enriched.siretOrVat) extraNotes.push(`Legal ID: ${enriched.siretOrVat}`);

          if (extraNotes.length > 0) {
            updateObj.notes = lead.notes ? `${lead.notes}\n${extraNotes.join('\n')}` : extraNotes.join('\n');
          }

          await db.update(schema.leads).set(updateObj).where(eq(schema.leads.id, lead.id));
        }

        // Phase H: Fast Audit
        try {
          await WebsiteService.performAudit(lead.id, website);
          results.auditsCompleted = (results.auditsCompleted || 0) + 1;
        } catch (auditErr: any) {
          console.warn(`[JobService] Audit failed for #${lead.id}: ${auditErr.message}`);
        }
      } else {
        // Phase G-Fallback: No Traditional Website -> Extract Maximum Information from Social Media
        // (100% Real public data only - zero fake/synthetic data)
        const rawTags = (lead.rawData as any)?.tags || (lead.rawData as any) || {};
        const socialResult = await SocialEnrichmentService.enrichFromSocialMedia(
          lead.companyName, 
          lead.city, 
          lead.country, 
          rawTags
        );

        if (socialResult.evidence.length > 0) {
          const evidenceBatch = socialResult.evidence.map(e => ({
            leadId: lead.id,
            fieldName: e.field,
            value: e.value,
            source: socialResult.platform ? `${socialResult.platform.toUpperCase()}_PROFILE` : 'SOCIAL_PRESENCE',
            sourceUrl: e.url,
            verified: e.confidence === 'HIGH',
            confidence: e.confidence
          }));

          await db.insert(schema.fieldEvidence).values(evidenceBatch);

          const updateObj: any = {
            lastEnrichedAt: new Date(),
            enrichmentSource: 'SOCIAL_MEDIA'
          };

          if (socialResult.socialUrl) {
            updateObj.website = socialResult.socialUrl;
            updateObj.websiteStatus = 'social_profile';
            updateObj.websiteConfidence = 'HIGH';
            results.verifiedWebsites = (results.verifiedWebsites || 0) + 1;
          }

          if (!lead.phone && socialResult.phone) {
            updateObj.phone = socialResult.phone;
            results.phonesFound = (results.phonesFound || 0) + 1;
          }
          if (!lead.email && socialResult.email) {
            updateObj.email = socialResult.email;
            results.emailsFound = (results.emailsFound || 0) + 1;
          }
          if (!lead.address && socialResult.address) {
            updateObj.address = socialResult.address;
          }
          if (socialResult.bio) {
            updateObj.notes = lead.notes ? `${lead.notes}\nBio: ${socialResult.bio}` : `Bio: ${socialResult.bio}`;
          }

          await db.update(schema.leads).set(updateObj).where(eq(schema.leads.id, lead.id));
        }
      }

      // Phase I: Opportunity Assessment
      try {
        await OpportunityService.analyzeLead(lead.id);
        results.opportunitiesAnalyzed = (results.opportunitiesAnalyzed || 0) + 1;
      } catch (oppErr: any) {
        console.warn(`[JobService] Opportunity analysis failed for #${lead.id}: ${oppErr.message}`);
      }

    } catch (err: any) {
      console.warn(`[JobService] Lead enrichment failed for #${lead.id}: ${err.message}`);
    }
  }

  static async runCSVImport(jobId: number, rows: any[], mapping: any, campaignId?: number) {
    try {
      await this.updateJobProgress(jobId, 0, 'running');
      const results = { imported: 0, duplicates: 0, failed: 0 };

      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const rawLead = {
            companyName: row[mapping.companyName],
            phone: row[mapping.phone],
            email: row[mapping.email],
            website: row[mapping.website],
            source: 'CSV'
          };

          if (rawLead.companyName) {
            const { status } = await LeadService.createLead(rawLead, campaignId);
            if (status === 'created') results.imported++;
            else results.duplicates++;
          }
        } catch (err) {
          console.error('CSV Import row failed:', err);
          results.failed++;
        }
        await this.updateJobProgress(jobId, i + 1);
        await db.update(schema.jobs).set({ results }).where(eq(schema.jobs.id, jobId));
      }

      await db.update(schema.jobs)
        .set({ status: 'completed', results, progress: rows.length, updatedAt: new Date() })
        .where(eq(schema.jobs.id, jobId));

    } catch (error: any) {
      console.error('CSV Import job failed:', error);
      await this.failJob(jobId, error.message);
    }
  }
}
