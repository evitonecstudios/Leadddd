import { db } from '../db/index.ts';
import * as schema from '../db/schema.ts';
import { eq } from 'drizzle-orm';
import { SourceRegistry } from './sources/registry.ts';
import { LeadService, NormalizationService, ValidationService } from './leadService.ts';
import { GridPartitionService, type BoundingBox } from './gridPartitionService.ts';
import { IdentityService } from './identityService.ts';
import { EnrichmentBot } from './enrichmentBot.ts';
import { SearchProviderFactory } from './search/types.ts';
import { WebsiteService } from './websiteService.ts';
import { OpportunityService } from './opportunityService.ts';
import { SocialEnrichmentService } from './socialEnrichmentService.ts';
import { analyzePhoneNumber } from '../lib/phoneUtils.ts';
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

  private static async deleteUnmatchedLead(leadId: number) {
    try {
      await db.delete(schema.fieldEvidence).where(eq(schema.fieldEvidence.leadId, leadId));
      await db.delete(schema.leads).where(eq(schema.leads.id, leadId));
    } catch {}
  }

  private static matchesPreEnrichmentFilter(rawLead: any, criteria: any): boolean {
    const hasOfficialWeb = Boolean(
      rawLead.website && !ValidationService.isSocialOrDirectoryUrl(rawLead.website)
    );

    if (criteria.intentMode === 'NO_WEBSITE' || criteria.targetNoWebsite) {
      if (hasOfficialWeb) return false;
    }

    if (criteria.intentMode === 'FACEBOOK_NO_WEBSITE') {
      if (hasOfficialWeb) return false;
    }

    return true;
  }

  static async runLeadGeneration(jobId: number, sourceId: string, criteria: any, campaignId?: number, isResume: boolean = false) {
    const startTime = Date.now();
    try {
      const job = await db.query.jobs.findFirst({ where: eq(schema.jobs.id, jobId) });
      if (!job) return;

      const results = (job.results as any) || {};
      const targetCount = criteria.maxResults || criteria.limit || 50;
      results.target = targetCount;
      results.validBusinesses = results.validBusinesses || 0;
      results.newLeadsSaved = results.newLeadsSaved || 0;
      results.totalFound = results.totalFound || 0;

      let cells: Array<BoundingBox | null> = [];
      const location = `${criteria.city || ''} ${criteria.country || ''}`.trim();
      
      results.currentStep = 'Calcul des partitions géographiques...';
      await this.updateJobProgress(jobId, results.newLeadsSaved || 0, 'running', results);

      // Phase 1. Geographic Partitioning
      const masterBbox = await GridPartitionService.getBoundingBox(location);
      if (masterBbox) {
        const divisions = GridPartitionService.calculateDivisions(masterBbox, targetCount);
        cells = GridPartitionService.partition(masterBbox, divisions);
      } else {
        cells = [null];
      }

      results.cellsTotal = cells.length;
      const resumeCellIdx = isResume ? (results.cellsCompleted || 0) : 0;
      if (!isResume) results.cellsCompleted = 0;
      await this.updateJobProgress(jobId, results.newLeadsSaved || 0, 'running', results);

      const source = SourceRegistry.getSource(sourceId);
      let totalSaved = results.newLeadsSaved || 0;
      let currentMasterBbox = masterBbox;
      
      if (!currentMasterBbox && (criteria.city || criteria.country)) {
        currentMasterBbox = await GridPartitionService.getBoundingBox(criteria.city || criteria.country);
        if (currentMasterBbox) {
          const divisions = GridPartitionService.calculateDivisions(currentMasterBbox, targetCount);
          cells = GridPartitionService.partition(currentMasterBbox, divisions);
          results.cellsTotal = cells.length;
        }
      }

      let expansionTier = 1;
      const MAX_TIERS = 2;

      while (totalSaved < targetCount && expansionTier <= MAX_TIERS) {
        if (expansionTier > 1 && currentMasterBbox) {
          results.currentStep = `Recherche en cours (${totalSaved}/${targetCount} prospects). Élargissement à la périphérie locale...`;
          await this.updateJobProgress(jobId, totalSaved, 'running', results);
          
          currentMasterBbox = GridPartitionService.expandBoundingBox(currentMasterBbox, 1.6);
          const divisions = Math.min(GridPartitionService.calculateDivisions(currentMasterBbox, targetCount), 3);
          cells = GridPartitionService.partition(currentMasterBbox, divisions);
          results.cellsTotal = cells.length;
          results.cellsCompleted = 0;
        }

        const cellStartIdx = expansionTier === 1 ? Math.min(resumeCellIdx, Math.max(0, cells.length - 1)) : 0;

        // Phase 2. Controlled Cell Discovery
        for (let cellIdx = cellStartIdx; cellIdx < cells.length; cellIdx++) {
          if (totalSaved >= targetCount) break;

          const cell = cells[cellIdx];
          results.currentCell = `Zone ${cellIdx + 1}/${cells.length} (Niveau ${expansionTier})`;
          results.currentStep = `Extraction & qualification Scrapling (${totalSaved}/${targetCount} prospects)...`;
          await this.updateJobProgress(jobId, totalSaved, 'running', results);

          try {
            const needed = targetCount - totalSaved;
            // Overpass query retrieves extra candidates when strict post-filters are active
            const isStrictMode = Boolean(
              criteria.intentMode === 'FACEBOOK_NO_WEBSITE' ||
              criteria.intentMode === 'WHATSAPP' ||
              criteria.intentMode === 'NO_WEBSITE' ||
              criteria.requireWhatsApp
            );
            const fetchLimit = Math.min(Math.max(needed * (isStrictMode ? 4 : 2), 60), 200);
            const queryParams: any = { 
              ...criteria, 
              limit: fetchLimit
            };
            if (cell) queryParams.bbox = cell;

            const rawLeads = await source.search(queryParams);
            results.totalFound += rawLeads.length;

            if (rawLeads.length > 0 && (rawLeads[0] as any).rawData?.chainsExcludedCount) {
              results.chainsFiltered = (results.chainsFiltered || 0) + (rawLeads[0] as any).rawData.chainsExcludedCount;
            }

            // Pre-filter before spawning enrichment workers
            const candidates = rawLeads.filter(r => this.matchesPreEnrichmentFilter(r, criteria));

            // Process leads in concurrent batches of 12 for high-speed lead generation
            const BATCH_SIZE = 12;
            for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
              if (totalSaved >= targetCount) break;
              const chunk = candidates.slice(i, i + BATCH_SIZE);

              const chunkPromises = chunk.map(async (rawLead) => {
                if (totalSaved >= targetCount) return null;

                const { lead, status } = await LeadService.createLead(rawLead, campaignId, {
                  requireVerifiedContact: false 
                });

                if (status === 'created' && lead) {
                  // Concurrent Scrapling & Social Enrichment
                  const enrichedState = await this.enrichLead(lead, results, criteria, rawLead.rawData);

                  // Final check against user filters after Scrapling/Enrichment
                  const isMatch = await this.checkLeadMatchesCriteria(lead.id, criteria);
                  
                  if (isMatch) {
                    if (totalSaved >= targetCount) {
                      await this.deleteUnmatchedLead(lead.id);
                      return null;
                    }
                    results.validBusinesses++;
                    results.newLeadsSaved++;
                    totalSaved++;

                    // Trigger opportunity analysis & website audit in background ONLY for qualified leads
                    OpportunityService.analyzeLead(lead.id)
                      .then(() => { results.opportunitiesAnalyzed = (results.opportunitiesAnalyzed || 0) + 1; })
                      .catch(() => {});
                    const activeWeb = enrichedState?.website || lead.website;
                    if (activeWeb && !ValidationService.isSocialOrDirectoryUrl(activeWeb)) {
                      WebsiteService.performAudit(lead.id, activeWeb)
                        .then(() => { results.auditsCompleted = (results.auditsCompleted || 0) + 1; })
                        .catch(() => {});
                    }
                    return lead;
                  } else {
                    await this.deleteUnmatchedLead(lead.id);
                    return null;
                  }
                } else if (status === 'rejected_unverified') {
                  results.unverifiedFiltered = (results.unverifiedFiltered || 0) + 1;
                } else {
                  results.duplicates++;
                }
                return null;
              });

              await Promise.allSettled(chunkPromises);
              await this.updateJobProgress(jobId, totalSaved, 'running', results);
            }

            results.cellsCompleted = cellIdx + 1;
            await this.updateJobProgress(jobId, totalSaved, 'running', results);
          } catch (cellErr: any) {
            await logger.error('JOB', `Discovery issue in Tier ${expansionTier}: ${cellErr.message}`, cellErr, { jobId, cellIdx });
            results.cellsCompleted = cellIdx + 1;
            await this.updateJobProgress(jobId, totalSaved, 'running', results);
          }
        }

        if (totalSaved < targetCount && currentMasterBbox) {
          expansionTier++;
        } else {
          break;
        }
      }

      // Secondary Wave: Only if Overpass yielded sparse raw candidates
      if (totalSaved < targetCount && results.totalFound < targetCount && (criteria.city || criteria.country) && criteria.category) {
        results.currentStep = `Vague complémentaire pour atteindre ${targetCount} prospects...`;
        await this.updateJobProgress(jobId, totalSaved, 'running', results);

        try {
          const needed = targetCount - totalSaved;
          const fallbackLeads = await (source as any).searchNominatim?.(criteria.category, criteria.city, criteria.country, needed + 15) || [];
          const candidates = fallbackLeads.filter((r: any) => this.matchesPreEnrichmentFilter(r, criteria));
          
          const BATCH_SIZE = 12;
          for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            if (totalSaved >= targetCount) break;
            const chunk = candidates.slice(i, i + BATCH_SIZE);

            await Promise.allSettled(chunk.map(async (rawLead: any) => {
              if (totalSaved >= targetCount) return;

              const { lead, status } = await LeadService.createLead(rawLead, campaignId, {
                requireVerifiedContact: false
              });
              if (status === 'created' && lead) {
                const enrichedState = await this.enrichLead(lead, results, criteria, rawLead.rawData);
                const isMatch = await this.checkLeadMatchesCriteria(lead.id, criteria);
                if (isMatch && totalSaved < targetCount) {
                  results.validBusinesses++;
                  results.newLeadsSaved++;
                  totalSaved++;

                  OpportunityService.analyzeLead(lead.id)
                    .then(() => { results.opportunitiesAnalyzed = (results.opportunitiesAnalyzed || 0) + 1; })
                    .catch(() => {});
                  const activeWeb = enrichedState?.website || lead.website;
                  if (activeWeb && !ValidationService.isSocialOrDirectoryUrl(activeWeb)) {
                    WebsiteService.performAudit(lead.id, activeWeb)
                      .then(() => { results.auditsCompleted = (results.auditsCompleted || 0) + 1; })
                      .catch(() => {});
                  }
                } else {
                  await this.deleteUnmatchedLead(lead.id);
                }
              } else if (status === 'rejected_unverified') {
                results.unverifiedFiltered = (results.unverifiedFiltered || 0) + 1;
              } else {
                results.duplicates++;
              }
            }));
            await this.updateJobProgress(jobId, totalSaved, 'running', results);
          }
        } catch (e: any) {
          console.warn('Secondary discovery wave warning:', e.message);
        }
      }

      // Complete
      results.currentStep = `Terminé avec succès. ${results.validBusinesses} prospects qualifiés découverts.`;
      results.currentCell = 'Terminé';
      await this.updateJobProgress(jobId, totalSaved, 'completed', results);
      await metrics.record('JOB', 'LEAD_GEN', 'SUCCESS', Date.now() - startTime, { jobId, totalSaved });

    } catch (error: any) {
      console.error('Job execution failed:', error);
      await this.failJob(jobId, error.message);
    }
  }

  private static async enrichLead(
    lead: any,
    results: any,
    criteria: any,
    rawData?: any
  ): Promise<{ website?: string | null }> {
    try {
      let website = lead.website;

      // Optional website discovery when website is missing in OSM and mode allows official websites
      const disallowWebsiteDiscovery = Boolean(
        criteria?.intentMode === 'NO_WEBSITE' ||
        criteria?.intentMode === 'FACEBOOK_NO_WEBSITE' ||
        criteria?.targetNoWebsite
      );

      if (!website && !disallowWebsiteDiscovery && (!lead.phone || !lead.email) && lead.companyName) {
        try {
          const candidates = await SearchProviderFactory.findWebsites(lead.companyName, lead.city || '');
          const best = candidates
            .map(c => ({ ...c, score: IdentityService.calculateRelevanceScore(lead.companyName, c.url, lead.address, lead.city) }))
            .sort((a, b) => b.score - a.score)[0];

          if (best && best.score >= 50 && !ValidationService.isSocialOrDirectoryUrl(best.url)) {
            website = best.url;
            results.websiteCandidates = (results.websiteCandidates || 0) + 1;
            const normDomain = NormalizationService.normalizeDomain(website);
            await db.update(schema.leads).set({
              website,
              normalizedDomain: normDomain,
              websiteCandidate: website,
              websiteStatus: 'verified',
              websiteConfidence: 'MEDIUM'
            }).where(eq(schema.leads.id, lead.id));
            lead.website = website;
          }
        } catch {}
      }

      if (website) {
        results.verifiedWebsites = (results.verifiedWebsites || 0) + 1;
      }

      // Phase G: High-Speed Contact Enrichment via Scrapling
      if (website && !ValidationService.isSocialOrDirectoryUrl(website)) {
        const enriched = await EnrichmentBot.enrich(website);
        results.pagesCrawled = (results.pagesCrawled || 0) + 1;

        if (enriched.evidence.length > 0) {
          const evidenceBatch = enriched.evidence.map(e => ({
            leadId: lead.id,
            fieldName: e.field,
            value: e.value,
            source: 'SCRAPLING_WEBSITE',
            sourceUrl: e.url,
            verified: e.confidence === 'HIGH',
            confidence: e.confidence
          }));

          await db.insert(schema.fieldEvidence).values(evidenceBatch);

          const updateObj: any = {
            lastEnrichedAt: new Date(),
            enrichmentSource: 'SCRAPLING_WEBSITE'
          };

          // Pick best phone (prefer mobile if targeting WhatsApp)
          let chosenPhone = enriched.phone;
          if ((criteria?.intentMode === 'WHATSAPP' || criteria?.requireWhatsApp) && enriched.allPhones?.length) {
            const mobileCand = enriched.allPhones.find(p => analyzePhoneNumber(p, lead.country).isWhatsAppReady);
            if (mobileCand) chosenPhone = mobileCand;
          }

          if ((!lead.phone || ((criteria?.intentMode === 'WHATSAPP' || criteria?.requireWhatsApp) && chosenPhone && analyzePhoneNumber(chosenPhone, lead.country).isWhatsAppReady && !analyzePhoneNumber(lead.phone, lead.country).isWhatsAppReady)) && chosenPhone) {
            const formatted = NormalizationService.formatDisplayPhone(chosenPhone, lead.country) || chosenPhone;
            updateObj.phone = formatted;
            updateObj.normalizedPhone = NormalizationService.normalizePhone(chosenPhone);
            if (!lead.phone) results.phonesFound = (results.phonesFound || 0) + 1;
            lead.phone = formatted;
          }

          if (!lead.email && enriched.email) {
            updateObj.email = enriched.email;
            results.emailsFound = (results.emailsFound || 0) + 1;
            lead.email = enriched.email;
          }

          if (!lead.address && enriched.address) {
            updateObj.address = enriched.address;
            lead.address = enriched.address;
          }

          const extraNotes: string[] = [];
          const existingNotes = lead.notes || '';
          if (enriched.whatsapp && !existingNotes.includes(enriched.whatsapp)) {
            extraNotes.push(`WhatsApp: ${enriched.whatsapp}`);
          }
          if (enriched.socialLinks?.facebook && !existingNotes.includes('facebook.com')) {
            extraNotes.push(`Facebook: ${enriched.socialLinks.facebook}`);
          }
          if (enriched.socialLinks?.instagram && !existingNotes.includes('instagram.com')) {
            extraNotes.push(`Instagram: ${enriched.socialLinks.instagram}`);
          }
          if (enriched.openingHours && !existingNotes.includes('Hours:')) {
            extraNotes.push(`Hours: ${enriched.openingHours}`);
          }
          if (enriched.managerName && !existingNotes.includes(enriched.managerName)) {
            extraNotes.push(`Dirigeant/Manager: ${enriched.managerName}`);
          }
          if (enriched.siretOrVat && !existingNotes.includes(enriched.siretOrVat)) {
            extraNotes.push(`Legal ID: ${enriched.siretOrVat}`);
          }

          if (extraNotes.length > 0) {
            updateObj.notes = existingNotes ? `${existingNotes}\n${extraNotes.join('\n')}` : extraNotes.join('\n');
            lead.notes = updateObj.notes;
          }

          const quality = NormalizationService.computeDataQuality({
            phone: updateObj.phone || lead.phone,
            website,
            email: updateObj.email || lead.email,
            address: updateObj.address || lead.address,
            notes: updateObj.notes || lead.notes,
            rawData: { socialLinks: enriched.socialLinks }
          });
          updateObj.dataConfidence = quality.confidence;
          updateObj.opportunityScore = quality.score;

          await db.update(schema.leads).set(updateObj).where(eq(schema.leads.id, lead.id));
        }
      } else {
        // Phase G-Fallback: No Traditional Website -> Extract Maximum Information from Social Media
        const rawTags = { ...(rawData?.tags || {}), ...(rawData?.socialLinks || {}) };
        if (rawData?.socialLinks?.facebook && !rawTags['contact:facebook']) {
          rawTags['contact:facebook'] = rawData.socialLinks.facebook;
        }
        if (rawData?.socialLinks?.instagram && !rawTags['contact:instagram']) {
          rawTags['contact:instagram'] = rawData.socialLinks.instagram;
        }

        const socialResult = await SocialEnrichmentService.enrichFromSocialMedia(
          lead.companyName, 
          lead.city, 
          lead.country, 
          rawTags
        );

        if (socialResult.evidence.length > 0 || Object.keys(socialResult.socialLinks).length > 0) {
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
          }

          const updateObj: any = {
            lastEnrichedAt: new Date(),
            enrichmentSource: 'SOCIAL_MEDIA'
          };

          if (socialResult.discoveredWebsite && !lead.website && !ValidationService.isSocialOrDirectoryUrl(socialResult.discoveredWebsite)) {
            updateObj.website = socialResult.discoveredWebsite;
            updateObj.normalizedDomain = NormalizationService.normalizeDomain(socialResult.discoveredWebsite);
            updateObj.websiteStatus = 'verified';
            updateObj.websiteConfidence = 'HIGH';
            results.verifiedWebsites = (results.verifiedWebsites || 0) + 1;
            website = socialResult.discoveredWebsite;
          } else if (Object.keys(socialResult.socialLinks).length > 0 && !lead.website) {
            updateObj.websiteStatus = 'social_profile';
            updateObj.websiteConfidence = 'MEDIUM';
          }

          if (!lead.phone && socialResult.phone) {
            const formatted = NormalizationService.formatDisplayPhone(socialResult.phone, lead.country) || socialResult.phone;
            updateObj.phone = formatted;
            updateObj.normalizedPhone = NormalizationService.normalizePhone(socialResult.phone);
            results.phonesFound = (results.phonesFound || 0) + 1;
            lead.phone = formatted;
          }
          if (!lead.email && socialResult.email) {
            updateObj.email = socialResult.email;
            results.emailsFound = (results.emailsFound || 0) + 1;
            lead.email = socialResult.email;
          }
          if (!lead.address && socialResult.address) {
            updateObj.address = socialResult.address;
          }

          const socialNotes: string[] = [];
          const existingNotes = lead.notes || '';
          if (socialResult.socialLinks.facebook && !existingNotes.includes('facebook.com')) {
            socialNotes.push(`Facebook: ${socialResult.socialLinks.facebook}`);
          }
          if (socialResult.socialLinks.instagram && !existingNotes.includes('instagram.com')) {
            socialNotes.push(`Instagram: ${socialResult.socialLinks.instagram}`);
          }
          if (socialResult.socialLinks.linkedin && !existingNotes.includes('linkedin.com')) {
            socialNotes.push(`LinkedIn: ${socialResult.socialLinks.linkedin}`);
          }
          if (socialResult.bio && !existingNotes.includes(socialResult.bio)) {
            socialNotes.push(`Bio: ${socialResult.bio}`);
          }

          if (socialNotes.length > 0) {
            updateObj.notes = existingNotes ? `${existingNotes}\n${socialNotes.join('\n')}` : socialNotes.join('\n');
            lead.notes = updateObj.notes;
          }

          const quality = NormalizationService.computeDataQuality({
            phone: updateObj.phone || lead.phone,
            website: updateObj.website || lead.website,
            email: updateObj.email || lead.email,
            address: updateObj.address || lead.address,
            notes: updateObj.notes || lead.notes,
            rawData: { socialLinks: socialResult.socialLinks }
          });
          updateObj.dataConfidence = quality.confidence;
          updateObj.opportunityScore = quality.score;

          await db.update(schema.leads).set(updateObj).where(eq(schema.leads.id, lead.id));
        }
      }

      return { website };
    } catch (err: any) {
      console.warn(`[JobService] Lead enrichment failed for #${lead.id}: ${err.message}`);
      return {};
    }
  }
  
  private static async checkLeadMatchesCriteria(leadId: number, criteria: any): Promise<boolean> {
    const lead = await db.query.leads.findFirst({
      where: eq(schema.leads.id, leadId),
      with: { evidence: true }
    });
    if (!lead) return false;

    const evidenceList = (lead as any).evidence || [];
    const hasOfficialWeb = Boolean(
      lead.website && !ValidationService.isSocialOrDirectoryUrl(lead.website)
    );
    const hasFacebook = Boolean(
      lead.notes?.toLowerCase().includes('facebook.com') ||
      lead.website?.toLowerCase().includes('facebook.com') ||
      evidenceList.some((e: any) => e.fieldName === 'facebook' && e.value)
    );
    const hasExplicitWa = Boolean(
      lead.notes?.toLowerCase().includes('whatsapp') ||
      evidenceList.some((e: any) => e.fieldName === 'whatsapp' && e.value)
    );
    const phoneAnalysis = analyzePhoneNumber(lead.phone, lead.country, hasExplicitWa);
    const hasWhatsApp = Boolean(hasExplicitWa || phoneAnalysis.isWhatsAppReady);

    // 1. Direct Call Phone Filter
    if (criteria.intentMode === 'DIRECT_CALL' || criteria.requireDirectPhone) {
      if (!lead.phone || !ValidationService.validatePhone(lead.phone)) return false;
    }

    // 2. WhatsApp Filter
    if (criteria.requireWhatsApp || criteria.intentMode === 'WHATSAPP') {
      if (!hasWhatsApp) return false;
    }

    // 3. Facebook (No Website) Filter
    if (criteria.intentMode === 'FACEBOOK_NO_WEBSITE') {
      if (!hasFacebook || hasOfficialWeb) return false;
    }

    // 4. No Website Filter
    if (criteria.intentMode === 'NO_WEBSITE' || criteria.targetNoWebsite) {
      if (hasOfficialWeb) return false;
    }

    // 5. Mandatory Contact Info check if requested
    if (criteria.requireContactInfo) {
      const hasContact = Boolean(
        (lead.phone && ValidationService.validatePhone(lead.phone)) ||
        (lead.email && ValidationService.validateEmail(lead.email)) ||
        hasOfficialWeb ||
        (criteria.intentMode === 'FACEBOOK_NO_WEBSITE' && hasFacebook)
      );
      if (!hasContact) return false;
    }

    return true;
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
