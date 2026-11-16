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
      const IS_VERCEL = Boolean(process.env.VERCEL);
      const VERCEL_SAFE_BUDGET_MS = 45000;
      const isOverBudget = () => IS_VERCEL && (Date.now() - startTime) >= VERCEL_SAFE_BUDGET_MS;
      const bgTasks: Promise<any>[] = [];

      while (totalSaved < targetCount && expansionTier <= MAX_TIERS && !isOverBudget()) {
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
          if (totalSaved >= targetCount || isOverBudget()) break;

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
              if (totalSaved >= targetCount || isOverBudget()) break;
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
                    bgTasks.push(
                      OpportunityService.analyzeLead(lead.id)
                        .then(() => { results.opportunitiesAnalyzed = (results.opportunitiesAnalyzed || 0) + 1; })
                        .catch(() => {})
                    );
                    const activeWeb = enrichedState?.website || lead.website;
                    if (activeWeb && !ValidationService.isSocialOrDirectoryUrl(activeWeb)) {
                      bgTasks.push(
                        WebsiteService.performAudit(lead.id, activeWeb)
                          .then(() => { results.auditsCompleted = (results.auditsCompleted || 0) + 1; })
                          .catch(() => {})
                      );
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
      if (totalSaved < targetCount && results.totalFound < targetCount && !isOverBudget() && (criteria.city || criteria.country) && criteria.category) {
        results.currentStep = `Vague complémentaire pour atteindre ${targetCount} prospects...`;
        await this.updateJobProgress(jobId, totalSaved, 'running', results);

        try {
          const needed = targetCount - totalSaved;
          const fallbackLeads = await (source as any).searchNominatim?.(criteria.category, criteria.city, criteria.country, needed + 15) || [];
          const candidates = fallbackLeads.filter((r: any) => this.matchesPreEnrichmentFilter(r, criteria));
          
          const BATCH_SIZE = 12;
          for (let i = 0; i < candidates.length; i += BATCH_SIZE) {
            if (totalSaved >= targetCount || isOverBudget()) break;
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

                  bgTasks.push(
                    OpportunityService.analyzeLead(lead.id)
                      .then(() => { results.opportunitiesAnalyzed = (results.opportunitiesAnalyzed || 0) + 1; })
                      .catch(() => {})
                  );
                  const activeWeb = enrichedState?.website || lead.website;
                  if (activeWeb && !ValidationService.isSocialOrDirectoryUrl(activeWeb)) {
                    bgTasks.push(
                      WebsiteService.performAudit(lead.id, activeWeb)
                        .then(() => { results.auditsCompleted = (results.auditsCompleted || 0) + 1; })
                        .catch(() => {})
                    );
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

      // Wait briefly for in-flight opportunity/audit writes before serverless function exits
      if (bgTasks.length > 0) {
        await Promise.race([
          Promise.allSettled(bgTasks),
          new Promise((resolve) => setTimeout(resolve, 4000))
        ]);
      }

      // Complete
      const timedOutEarly = isOverBudget() && totalSaved < targetCount;
      results.canResume = timedOutEarly;
      results.currentStep = timedOutEarly
        ? `Limite serverless atteinte : ${results.validBusinesses} prospects sauvegardés (vous pouvez cliquer sur Reprendre).`
        : `Terminé avec succès. ${results.validBusinesses} prospects qualifiés découverts.`;
      results.currentCell = 'Terminé';
      await this.updateJobProgress(jobId, totalSaved, 'completed', results);
      await metrics.record('JOB', 'LEAD_GEN', 'SUCCESS', Date.now() - startTime, { jobId, totalSaved, timedOutEarly });

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

      const appendUniqueNote = (notesArr: string[], existing: string, label: string, val?: string | null) => {
        if (!val || typeof val !== 'string') return;
        const cleanVal = val.trim();
        if (!cleanVal) return;
        const lowerExisting = existing.toLowerCase();
        const lowerLine = `${label.toLowerCase()} ${cleanVal.toLowerCase()}`;
        if (lowerExisting.includes(cleanVal.toLowerCase()) || notesArr.some(n => n.toLowerCase() === lowerLine || n.toLowerCase().includes(cleanVal.toLowerCase()))) {
          return;
        }
        notesArr.push(`${label} ${cleanVal}`);
      };

      const isGenericAddress = (addr?: string | null) => {
        if (!addr || addr.trim().length < 5) return true;
        const genericFallback = [lead.city, lead.country].filter(Boolean).join(', ').toLowerCase();
        const lower = addr.trim().toLowerCase();
        return lower === genericFallback || (lead.city && lower === String(lead.city).trim().toLowerCase());
      };

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

      const rawTags: Record<string, any> = {
        ...(rawData?.tags || {}),
        ...(rawData?.socialLinks || {})
      };
      if (rawData?.socialLinks?.facebook && !rawTags['contact:facebook']) {
        rawTags['contact:facebook'] = rawData.socialLinks.facebook;
      }
      if (rawData?.socialLinks?.instagram && !rawTags['contact:instagram']) {
        rawTags['contact:instagram'] = rawData.socialLinks.instagram;
      }
      if (rawData?.socialLinks?.linkedin && !rawTags['contact:linkedin']) {
        rawTags['contact:linkedin'] = rawData.socialLinks.linkedin;
      }
      if (rawData?.socialLinks?.twitter && !rawTags['contact:twitter']) {
        rawTags['contact:twitter'] = rawData.socialLinks.twitter;
      }

      // Phase G: High-Speed Contact Enrichment via Scrapling + Dual-Pass Social Fallback
      if (website && !ValidationService.isSocialOrDirectoryUrl(website)) {
        const enriched = await EnrichmentBot.enrich(website);
        results.pagesCrawled = (results.pagesCrawled || 0) + 1;

        const mergedSocial: Record<string, string> = {
          ...(rawData?.socialLinks || {}),
          ...(enriched.socialLinks || {})
        };

        // Dual-Pass: If website timed out, blocked scraping, or left gaps in email/phone/social links, query SocialEnrichmentService
        let socialFallback: Awaited<ReturnType<typeof SocialEnrichmentService.enrichFromSocialMedia>> | null = null;
        const missingPhone = !lead.phone && !enriched.phone;
        const missingEmail = !lead.email && !enriched.email;
        const missingSocial = Object.keys(mergedSocial).length === 0;
        if (enriched.evidence.length === 0 || missingPhone || missingEmail || missingSocial) {
          try {
            socialFallback = await SocialEnrichmentService.enrichFromSocialMedia(
              lead.companyName,
              lead.city,
              lead.country,
              rawTags
            );
            Object.entries(socialFallback.socialLinks || {}).forEach(([platform, url]) => {
              if (url && !mergedSocial[platform]) mergedSocial[platform] = url;
            });
          } catch {}
        }

        const combinedEvidence: Array<{
          leadId: number;
          fieldName: string;
          value: string;
          source: string;
          sourceUrl: string;
          verified: boolean;
          confidence: 'HIGH' | 'MEDIUM' | 'LOW';
        }> = enriched.evidence.map(e => ({
          leadId: lead.id,
          fieldName: e.field,
          value: e.value,
          source: 'SCRAPLING_WEBSITE',
          sourceUrl: e.url,
          verified: e.confidence === 'HIGH',
          confidence: e.confidence
        }));

        if (socialFallback?.evidence?.length) {
          for (const se of socialFallback.evidence) {
            if (!combinedEvidence.some(ce => ce.fieldName === se.field && ce.value === se.value)) {
              combinedEvidence.push({
                leadId: lead.id,
                fieldName: se.field,
                value: se.value,
                source: socialFallback.platform ? `${socialFallback.platform.toUpperCase()}_PROFILE` : 'SOCIAL_PRESENCE',
                sourceUrl: se.url,
                verified: se.confidence === 'HIGH',
                confidence: se.confidence
              });
            }
          }
        }

        if (combinedEvidence.length > 0) {
          await db.insert(schema.fieldEvidence).values(combinedEvidence);
        }

        const updateObj: any = {
          lastEnrichedAt: new Date(),
          enrichmentSource: enriched.evidence.length > 0 ? 'SCRAPLING_WEBSITE' : (socialFallback?.evidence?.length ? 'SOCIAL_MEDIA' : 'OSM')
        };

        // Gather all phones deduplicated by normalized digits
        const phonePoolRaw = [
          ...(enriched.allPhones || []),
          ...(enriched.phone ? [enriched.phone] : []),
          ...(socialFallback?.phone ? [socialFallback.phone] : [])
        ];
        const phonePool: string[] = [];
        const seenPhoneDigits = new Set<string>();
        if (lead.phone) {
          seenPhoneDigits.add(NormalizationService.normalizePhone(lead.phone));
        }
        for (const p of phonePoolRaw) {
          const norm = NormalizationService.normalizePhone(p);
          if (norm.length >= 8 && !seenPhoneDigits.has(norm)) {
            seenPhoneDigits.add(norm);
            phonePool.push(p);
          }
        }

        // Pick best primary phone (prefer mobile if targeting WhatsApp)
        let chosenPhone = enriched.phone || socialFallback?.phone;
        if ((criteria?.intentMode === 'WHATSAPP' || criteria?.requireWhatsApp) && phonePoolRaw.length) {
          const mobileCand = phonePoolRaw.find(p => analyzePhoneNumber(p, lead.country).isWhatsAppReady);
          if (mobileCand) chosenPhone = mobileCand;
        }

        if (
          chosenPhone &&
          (!lead.phone ||
            ((criteria?.intentMode === 'WHATSAPP' || criteria?.requireWhatsApp) &&
              analyzePhoneNumber(chosenPhone, lead.country).isWhatsAppReady &&
              !analyzePhoneNumber(lead.phone, lead.country).isWhatsAppReady))
        ) {
          const formatted = NormalizationService.formatDisplayPhone(chosenPhone, lead.country) || chosenPhone;
          updateObj.phone = formatted;
          updateObj.normalizedPhone = NormalizationService.normalizePhone(chosenPhone);
          if (!lead.phone) results.phonesFound = (results.phonesFound || 0) + 1;
          lead.phone = formatted;
        }

        // Emails deduplicated
        const emailPoolRaw = [
          ...(enriched.allEmails || []),
          ...(enriched.email ? [enriched.email] : []),
          ...(socialFallback?.email ? [socialFallback.email] : [])
        ].map(e => e.trim().toLowerCase());
        const uniqueEmails = Array.from(new Set(emailPoolRaw.filter(e => ValidationService.validateEmail(e))));

        if (!lead.email && uniqueEmails.length > 0) {
          updateObj.email = uniqueEmails[0];
          results.emailsFound = (results.emailsFound || 0) + 1;
          lead.email = uniqueEmails[0];
        }

        // Upgrade generic city-only address when Scrapling/Social extracts a full street address
        const bestAddress = enriched.address || socialFallback?.address;
        if (bestAddress && bestAddress.trim().length >= 6 && isGenericAddress(lead.address)) {
          updateObj.address = bestAddress.trim();
          lead.address = updateObj.address;
        }

        const extraNotes: string[] = [];
        const existingNotes = lead.notes || '';
        const primaryPhoneNorm = NormalizationService.normalizePhone(lead.phone);
        const secondaryPhones = phonePool
          .filter(p => NormalizationService.normalizePhone(p) !== primaryPhoneNorm)
          .slice(0, 3)
          .map(p => NormalizationService.formatDisplayPhone(p, lead.country) || p);
        if (secondaryPhones.length > 0) {
          appendUniqueNote(extraNotes, existingNotes, 'Secondary Phone(s):', secondaryPhones.join(', '));
        }

        const secondaryEmails = uniqueEmails
          .filter(e => e !== (lead.email || '').toLowerCase())
          .slice(0, 3);
        if (secondaryEmails.length > 0) {
          appendUniqueNote(extraNotes, existingNotes, 'Secondary Email(s):', secondaryEmails.join(', '));
        }

        const waContact = enriched.whatsapp || socialFallback?.whatsapp;
        appendUniqueNote(extraNotes, existingNotes, 'WhatsApp:', waContact);
        appendUniqueNote(extraNotes, existingNotes, 'Facebook:', mergedSocial.facebook);
        appendUniqueNote(extraNotes, existingNotes, 'Instagram:', mergedSocial.instagram);
        appendUniqueNote(extraNotes, existingNotes, 'LinkedIn:', mergedSocial.linkedin);
        appendUniqueNote(extraNotes, existingNotes, 'Twitter:', mergedSocial.twitter);
        appendUniqueNote(extraNotes, existingNotes, 'YouTube:', mergedSocial.youtube);
        appendUniqueNote(extraNotes, existingNotes, 'TikTok:', mergedSocial.tiktok);
        appendUniqueNote(extraNotes, existingNotes, 'Hours:', enriched.openingHours || socialFallback?.openingHours || rawData?.openingHours);
        appendUniqueNote(extraNotes, existingNotes, 'Dirigeant/Manager:', enriched.managerName || rawData?.operator);
        appendUniqueNote(extraNotes, existingNotes, 'Legal Name:', enriched.legalName);
        appendUniqueNote(extraNotes, existingNotes, 'Legal ID:', enriched.siretOrVat);
        appendUniqueNote(extraNotes, existingNotes, 'Description:', enriched.tagline || socialFallback?.bio || rawData?.description);

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
          rawData: { socialLinks: mergedSocial }
        });
        updateObj.dataConfidence = quality.confidence;
        updateObj.opportunityScore = quality.score;

        await db.update(schema.leads).set(updateObj).where(eq(schema.leads.id, lead.id));
      } else {
        // Phase G-Fallback: No Traditional Website -> Extract Maximum Information from Social Media
        const socialResult = await SocialEnrichmentService.enrichFromSocialMedia(
          lead.companyName, 
          lead.city, 
          lead.country, 
          rawTags
        );

        const mergedSocial: Record<string, string> = {
          ...(rawData?.socialLinks || {}),
          ...(socialResult.socialLinks || {})
        };

        if (socialResult.evidence.length > 0 || Object.keys(mergedSocial).length > 0 || socialResult.whatsapp || socialResult.openingHours) {
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
            lead.website = website;
          } else if (Object.keys(mergedSocial).length > 0 && !lead.website) {
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
          if (socialResult.address && socialResult.address.trim().length >= 6 && isGenericAddress(lead.address)) {
            updateObj.address = socialResult.address.trim();
            lead.address = updateObj.address;
          }

          const socialNotes: string[] = [];
          const existingNotes = lead.notes || '';
          appendUniqueNote(socialNotes, existingNotes, 'WhatsApp:', socialResult.whatsapp);
          appendUniqueNote(socialNotes, existingNotes, 'Facebook:', mergedSocial.facebook);
          appendUniqueNote(socialNotes, existingNotes, 'Instagram:', mergedSocial.instagram);
          appendUniqueNote(socialNotes, existingNotes, 'LinkedIn:', mergedSocial.linkedin);
          appendUniqueNote(socialNotes, existingNotes, 'Twitter:', mergedSocial.twitter);
          appendUniqueNote(socialNotes, existingNotes, 'YouTube:', mergedSocial.youtube);
          appendUniqueNote(socialNotes, existingNotes, 'TikTok:', mergedSocial.tiktok);
          appendUniqueNote(socialNotes, existingNotes, 'Hours:', socialResult.openingHours || rawData?.openingHours);
          appendUniqueNote(socialNotes, existingNotes, 'Dirigeant/Manager:', rawData?.operator);
          appendUniqueNote(socialNotes, existingNotes, 'Bio:', socialResult.bio || rawData?.description);

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
            rawData: { socialLinks: mergedSocial }
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
  
  static matchesCriteria(lead: any, evidenceList: any[], criteria: any): boolean {
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

  private static async checkLeadMatchesCriteria(leadId: number, criteria: any): Promise<boolean> {
    const lead = await db.query.leads.findFirst({
      where: eq(schema.leads.id, leadId),
      with: { evidence: true }
    });
    if (!lead) return false;
    return this.matchesCriteria(lead, (lead as any).evidence || [], criteria);
  }

  static async enrichRawLeadStateless(rawLead: any, criteria: any) {
    if (ValidationService.isInvalidBusinessName(rawLead.companyName)) {
      return { matched: false, rejected: true };
    }
    if (!this.matchesPreEnrichmentFilter(rawLead, criteria)) {
      return { matched: false, rejected: false };
    }

    const rawWebsite = rawLead.website?.trim();
    const isSocialOrDir = ValidationService.isSocialOrDirectoryUrl(rawWebsite);
    let hasWebsite = Boolean(rawWebsite && !isSocialOrDir);
    let website: string | null = hasWebsite ? rawWebsite : null;

    const normalizedName = NormalizationService.normalizeCompanyName(rawLead.companyName || '');
    const formattedInitialPhone = rawLead.phone
      ? (NormalizationService.formatDisplayPhone(rawLead.phone, rawLead.country) || rawLead.phone)
      : null;

    let finalAddress = (rawLead.address || '').trim();
    if (!finalAddress || finalAddress.length < 3) {
      finalAddress = [rawLead.city, rawLead.country].filter(Boolean).join(', ');
    }

    const noteLines: string[] = [];
    const appendUnique = (label: string, val?: string | null) => {
      if (!val || typeof val !== 'string') return;
      const cleanVal = val.trim();
      if (!cleanVal) return;
      if (noteLines.some(n => n.toLowerCase().includes(cleanVal.toLowerCase()))) return;
      noteLines.push(`${label} ${cleanVal}`);
    };

    const mergedSocial: Record<string, string> = {};
    if (isSocialOrDir && rawWebsite) {
      const fb = SocialEnrichmentService.normalizeFacebookUrl(rawWebsite);
      const ig = SocialEnrichmentService.normalizeInstagramUrl(rawWebsite);
      const li = SocialEnrichmentService.normalizeLinkedInUrl(rawWebsite);
      const tw = SocialEnrichmentService.normalizeTwitterUrl(rawWebsite);
      if (fb) mergedSocial.facebook = fb;
      else if (ig) mergedSocial.instagram = ig;
      else if (li) mergedSocial.linkedin = li;
      else if (tw) mergedSocial.twitter = tw;
    }
    if (rawLead.rawData?.socialLinks && typeof rawLead.rawData.socialLinks === 'object') {
      Object.entries(rawLead.rawData.socialLinks).forEach(([k, v]) => {
        if (typeof v === 'string' && v && !mergedSocial[k]) mergedSocial[k] = v;
      });
    }

    const evidence: any[] = [];
    const pushEvidence = (fieldName: string, value: string, source: string, sourceUrl: string | null, confidence: 'HIGH' | 'MEDIUM' | 'LOW' = 'HIGH') => {
      if (!evidence.some(e => e.fieldName === fieldName && e.value === value)) {
        evidence.push({ fieldName, value, source, sourceUrl, verified: confidence === 'HIGH', confidence });
      }
    };

    if (formattedInitialPhone) pushEvidence('phone', formattedInitialPhone, 'OPENSTREETMAP', rawLead.sourceUrl || null);
    if (rawLead.email) pushEvidence('email', rawLead.email, 'OPENSTREETMAP', rawLead.sourceUrl || null);
    if (rawLead.address) pushEvidence('address', rawLead.address, 'OPENSTREETMAP', rawLead.sourceUrl || null);
    if (website) pushEvidence('website', website, 'OPENSTREETMAP', rawLead.sourceUrl || null);
    if (rawLead.rawData?.openingHours) pushEvidence('opening_hours', rawLead.rawData.openingHours, 'OPENSTREETMAP', rawLead.sourceUrl || null);
    Object.entries(mergedSocial).forEach(([p, u]) => pushEvidence(p, u, 'OPENSTREETMAP', u));

    const leadObj: any = {
      companyName: rawLead.companyName,
      normalizedCompanyName: normalizedName,
      category: rawLead.category || null,
      country: rawLead.country || 'France',
      region: rawLead.region || null,
      city: rawLead.city || null,
      address: finalAddress || null,
      latitude: rawLead.latitude ?? null,
      longitude: rawLead.longitude ?? null,
      phone: formattedInitialPhone,
      normalizedPhone: NormalizationService.normalizePhone(rawLead.phone) || null,
      email: rawLead.email || null,
      website,
      normalizedDomain: website ? NormalizationService.normalizeDomain(website) : null,
      source: rawLead.source || 'OpenStreetMap',
      sourceUrl: rawLead.sourceUrl || null,
      discoverySource: rawLead.source || 'OpenStreetMap',
      websiteStatus: website ? 'verified' : (Object.keys(mergedSocial).length > 0 ? 'social_profile' : 'not_detected'),
      websiteConfidence: website ? 'HIGH' : (Object.keys(mergedSocial).length > 0 ? 'MEDIUM' : 'UNKNOWN'),
      leadStatus: 'NEW',
      notes: null as string | null,
      auditScore: null as number | null,
      dataConfidence: 'LOW',
      opportunityScore: 0,
      enrichmentSource: 'OPENSTREETMAP',
      rawData: rawLead.rawData || null
    };

    const statsDelta = {
      websiteCandidates: 0,
      verifiedWebsites: website ? 1 : 0,
      pagesCrawled: 0,
      phonesFound: 0,
      emailsFound: 0
    };

    const disallowWebsiteDiscovery = Boolean(
      criteria?.intentMode === 'NO_WEBSITE' ||
      criteria?.intentMode === 'FACEBOOK_NO_WEBSITE' ||
      criteria?.targetNoWebsite
    );

    if (!website && !disallowWebsiteDiscovery && (!leadObj.phone || !leadObj.email) && leadObj.companyName) {
      try {
        const candidates = await SearchProviderFactory.findWebsites(leadObj.companyName, leadObj.city || '');
        const best = candidates
          .map(c => ({ ...c, score: IdentityService.calculateRelevanceScore(leadObj.companyName, c.url, leadObj.address, leadObj.city) }))
          .sort((a, b) => b.score - a.score)[0];
        if (best && best.score >= 50 && !ValidationService.isSocialOrDirectoryUrl(best.url)) {
          website = best.url;
          leadObj.website = website;
          leadObj.normalizedDomain = NormalizationService.normalizeDomain(website);
          leadObj.websiteStatus = 'verified';
          leadObj.websiteConfidence = 'MEDIUM';
          statsDelta.websiteCandidates++;
          statsDelta.verifiedWebsites++;
        }
      } catch {}
    }

    const rawTags: Record<string, any> = {
      ...(rawLead.rawData?.tags || {}),
      ...mergedSocial
    };

    const isGenericAddress = (addr?: string | null) => {
      if (!addr || addr.trim().length < 5) return true;
      const genericFallback = [leadObj.city, leadObj.country].filter(Boolean).join(', ').toLowerCase();
      const lower = addr.trim().toLowerCase();
      return lower === genericFallback || (leadObj.city && lower === String(leadObj.city).trim().toLowerCase());
    };

    if (website && !ValidationService.isSocialOrDirectoryUrl(website)) {
      const enriched = await EnrichmentBot.enrich(website);
      statsDelta.pagesCrawled++;

      Object.entries(enriched.socialLinks || {}).forEach(([k, v]) => {
        if (v && !mergedSocial[k]) mergedSocial[k] = v;
      });
      for (const e of enriched.evidence) {
        pushEvidence(e.field, e.value, 'SCRAPLING_WEBSITE', e.url, e.confidence);
      }

      let socialFallback: Awaited<ReturnType<typeof SocialEnrichmentService.enrichFromSocialMedia>> | null = null;
      if (enriched.evidence.length === 0 || (!leadObj.phone && !enriched.phone) || (!leadObj.email && !enriched.email) || Object.keys(mergedSocial).length === 0) {
        try {
          socialFallback = await SocialEnrichmentService.enrichFromSocialMedia(leadObj.companyName, leadObj.city, leadObj.country, rawTags);
          Object.entries(socialFallback.socialLinks || {}).forEach(([k, v]) => {
            if (v && !mergedSocial[k]) mergedSocial[k] = v;
          });
          for (const se of socialFallback.evidence) {
            pushEvidence(se.field, se.value, socialFallback.platform ? `${socialFallback.platform.toUpperCase()}_PROFILE` : 'SOCIAL_PRESENCE', se.url, se.confidence);
          }
        } catch {}
      }

      const phonePoolRaw = [...(enriched.allPhones || []), ...(enriched.phone ? [enriched.phone] : []), ...(socialFallback?.phone ? [socialFallback.phone] : [])];
      const phonePool: string[] = [];
      const seenDigits = new Set<string>();
      if (leadObj.phone) seenDigits.add(NormalizationService.normalizePhone(leadObj.phone));
      for (const p of phonePoolRaw) {
        const norm = NormalizationService.normalizePhone(p);
        if (norm.length >= 8 && !seenDigits.has(norm)) {
          seenDigits.add(norm);
          phonePool.push(p);
        }
      }

      let chosenPhone = enriched.phone || socialFallback?.phone;
      if ((criteria?.intentMode === 'WHATSAPP' || criteria?.requireWhatsApp) && phonePoolRaw.length) {
        const mobileCand = phonePoolRaw.find(p => analyzePhoneNumber(p, leadObj.country).isWhatsAppReady);
        if (mobileCand) chosenPhone = mobileCand;
      }

      if (chosenPhone && (!leadObj.phone || ((criteria?.intentMode === 'WHATSAPP' || criteria?.requireWhatsApp) && analyzePhoneNumber(chosenPhone, leadObj.country).isWhatsAppReady && !analyzePhoneNumber(leadObj.phone, leadObj.country).isWhatsAppReady))) {
        const formatted = NormalizationService.formatDisplayPhone(chosenPhone, leadObj.country) || chosenPhone;
        if (!leadObj.phone) statsDelta.phonesFound++;
        leadObj.phone = formatted;
        leadObj.normalizedPhone = NormalizationService.normalizePhone(chosenPhone);
      }

      const emailPool = Array.from(new Set([...(enriched.allEmails || []), ...(enriched.email ? [enriched.email] : []), ...(socialFallback?.email ? [socialFallback.email] : [])].map(e => e.trim().toLowerCase()).filter(e => ValidationService.validateEmail(e))));
      if (!leadObj.email && emailPool.length > 0) {
        leadObj.email = emailPool[0];
        statsDelta.emailsFound++;
      }

      const bestAddress = enriched.address || socialFallback?.address;
      if (bestAddress && bestAddress.trim().length >= 6 && isGenericAddress(leadObj.address)) {
        leadObj.address = bestAddress.trim();
      }

      const primaryNorm = NormalizationService.normalizePhone(leadObj.phone);
      const secondaryPhones = phonePool.filter(p => NormalizationService.normalizePhone(p) !== primaryNorm).slice(0, 3).map(p => NormalizationService.formatDisplayPhone(p, leadObj.country) || p);
      if (secondaryPhones.length > 0) appendUnique('Secondary Phone(s):', secondaryPhones.join(', '));
      const secondaryEmails = emailPool.filter(e => e !== (leadObj.email || '').toLowerCase()).slice(0, 3);
      if (secondaryEmails.length > 0) appendUnique('Secondary Email(s):', secondaryEmails.join(', '));
      appendUnique('WhatsApp:', enriched.whatsapp || socialFallback?.whatsapp || rawLead.whatsapp);
      appendUnique('Hours:', enriched.openingHours || socialFallback?.openingHours || rawLead.rawData?.openingHours);
      appendUnique('Dirigeant/Manager:', enriched.managerName || rawLead.rawData?.operator);
      appendUnique('Legal Name:', enriched.legalName);
      appendUnique('Legal ID:', enriched.siretOrVat);
      appendUnique('Description:', enriched.tagline || socialFallback?.bio || rawLead.rawData?.description);
      leadObj.enrichmentSource = enriched.evidence.length > 0 ? 'SCRAPLING_WEBSITE' : 'SOCIAL_MEDIA';
    } else {
      const socialResult = await SocialEnrichmentService.enrichFromSocialMedia(leadObj.companyName, leadObj.city, leadObj.country, rawTags);
      Object.entries(socialResult.socialLinks || {}).forEach(([k, v]) => {
        if (v && !mergedSocial[k]) mergedSocial[k] = v;
      });
      for (const se of socialResult.evidence) {
        pushEvidence(se.field, se.value, socialResult.platform ? `${socialResult.platform.toUpperCase()}_PROFILE` : 'SOCIAL_PRESENCE', se.url, se.confidence);
      }

      if (socialResult.discoveredWebsite && !leadObj.website && !ValidationService.isSocialOrDirectoryUrl(socialResult.discoveredWebsite)) {
        website = socialResult.discoveredWebsite;
        leadObj.website = website;
        leadObj.normalizedDomain = NormalizationService.normalizeDomain(website);
        leadObj.websiteStatus = 'verified';
        leadObj.websiteConfidence = 'HIGH';
        statsDelta.verifiedWebsites++;
      } else if (Object.keys(mergedSocial).length > 0 && !leadObj.website) {
        leadObj.websiteStatus = 'social_profile';
        leadObj.websiteConfidence = 'MEDIUM';
      }

      if (!leadObj.phone && socialResult.phone) {
        leadObj.phone = NormalizationService.formatDisplayPhone(socialResult.phone, leadObj.country) || socialResult.phone;
        leadObj.normalizedPhone = NormalizationService.normalizePhone(socialResult.phone);
        statsDelta.phonesFound++;
      }
      if (!leadObj.email && socialResult.email) {
        leadObj.email = socialResult.email;
        statsDelta.emailsFound++;
      }
      if (socialResult.address && socialResult.address.trim().length >= 6 && isGenericAddress(leadObj.address)) {
        leadObj.address = socialResult.address.trim();
      }
      appendUnique('WhatsApp:', socialResult.whatsapp || rawLead.whatsapp);
      appendUnique('Hours:', socialResult.openingHours || rawLead.rawData?.openingHours);
      appendUnique('Dirigeant/Manager:', rawLead.rawData?.operator);
      appendUnique('Bio:', socialResult.bio || rawLead.rawData?.description);
      leadObj.enrichmentSource = 'SOCIAL_MEDIA';
    }

    appendUnique('Facebook:', mergedSocial.facebook);
    appendUnique('Instagram:', mergedSocial.instagram);
    appendUnique('LinkedIn:', mergedSocial.linkedin);
    appendUnique('Twitter:', mergedSocial.twitter);
    appendUnique('YouTube:', mergedSocial.youtube);
    appendUnique('TikTok:', mergedSocial.tiktok);
    if (noteLines.length > 0) {
      leadObj.notes = noteLines.join('\n');
    }

    const isMatch = this.matchesCriteria(leadObj, evidence, criteria);
    if (!isMatch) {
      return { matched: false, rejected: false };
    }

    let auditResult: any = null;
    if (leadObj.website && !ValidationService.isSocialOrDirectoryUrl(leadObj.website)) {
      try {
        auditResult = await WebsiteService.performAuditStateless(leadObj.website);
        leadObj.auditScore = auditResult.overallScore;
        if (auditResult.isParked) {
          leadObj.websiteStatus = 'not_detected';
        }
      } catch {}
    }

    const oppResult = OpportunityService.computeOpportunities(leadObj, auditResult);
    const quality = NormalizationService.computeDataQuality({
      phone: leadObj.phone,
      website: leadObj.website,
      email: leadObj.email,
      address: leadObj.address,
      notes: leadObj.notes,
      rawData: { socialLinks: mergedSocial }
    });
    leadObj.dataConfidence = quality.confidence;
    leadObj.opportunityScore = Math.max(quality.score, oppResult.opportunityScore);
    leadObj.lastEnrichedAt = new Date().toISOString();

    return {
      matched: true,
      lead: leadObj,
      evidence,
      audit: auditResult,
      opportunities: oppResult.opportunities,
      statsDelta
    };
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
