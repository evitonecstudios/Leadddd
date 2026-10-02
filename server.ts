import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { requireAuth, AuthRequest } from './src/middleware/auth.ts';
import { getOrCreateUser } from './src/db/users.ts';
import { LeadService } from './src/services/leadService.ts';
import { WebsiteService } from './src/services/websiteService.ts';
import { JobService } from './src/services/jobService.ts';
import { SourceRegistry } from './src/services/sources/registry.ts';
import { OpportunityService } from './src/services/opportunityService.ts';
import { SearchProviderFactory } from './src/services/search/types.ts';
import { AIService } from './src/services/aiService.ts';
import { CRMService, LeadStatus } from './src/services/crmService.ts';
import { db } from './src/db/index.ts';
import { campaigns, leads, jobs, audits, auditFindings, opportunities, aiAnalyses, activities, notes, tasks, savedViews, systemLogs, requestMetrics, qualityReviews } from './src/db/schema.ts';
import { eq, and, sql, desc, isNull, ilike, or, gt, lt } from 'drizzle-orm';
import Papa from 'papaparse';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  app.use(express.json());
  app.use('/api', (req, res, next) => {
    if (req.path === '/health') return next();
    requireAuth(req as AuthRequest, res, next);
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/me', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!, req.user!.name);
      res.json({ success: true, data: user });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/dashboard/stats', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      
      const counts = await db.select({
        total: sql<number>`count(*)`,
        new: sql<number>`count(*) filter (where lead_status = 'NEW')`,
        reviewed: sql<number>`count(*) filter (where lead_status = 'REVIEWED')`,
        qualified: sql<number>`count(*) filter (where lead_status = 'QUALIFIED')`,
        contacted: sql<number>`count(*) filter (where lead_status = 'CONTACTED')`,
        replied: sql<number>`count(*) filter (where lead_status = 'REPLIED')`,
        won: sql<number>`count(*) filter (where lead_status = 'WON')`,
        websitesFound: sql<number>`count(*) filter (where website_status = 'verified')`,
        websitesMissing: sql<number>`count(*) filter (where website_status = 'not_detected')`,
        highOpportunity: sql<number>`count(*) filter (where opportunity_score > 60)`
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(eq(campaigns.userId, user.id), isNull(leads.deletedAt)));

      const oppCounts = await db.select({
        type: opportunities.type,
        count: sql<number>`count(*)`
      })
      .from(opportunities)
      .innerJoin(leads, eq(opportunities.leadId, leads.id))
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(and(eq(campaigns.userId, user.id), isNull(leads.deletedAt)))
      .groupBy(opportunities.type);

      res.json({ 
        success: true, 
        data: {
          ...counts[0],
          opportunities: oppCounts
        } 
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Leads with Filtering, Sorting, Pagination
  app.get('/api/leads', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { 
        status, country, city, category, 
        minOppScore, maxOppScore, 
        sortBy = 'createdAt', sortOrder = 'desc',
        page = '1', limit = '50',
        search
      } = req.query;

      let query = db.select()
        .from(leads)
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .where(and(
          eq(campaigns.userId, user.id),
          isNull(leads.deletedAt)
        ))
        .$dynamic();

      const conditions = [
        eq(campaigns.userId, user.id),
        isNull(leads.deletedAt)
      ];

      if (status) conditions.push(eq(leads.leadStatus, status as any));
      if (country) conditions.push(eq(leads.country, country as string));
      if (city) conditions.push(eq(leads.city, city as string));
      if (category) conditions.push(eq(leads.category, category as string));
      if (minOppScore) conditions.push(gt(leads.opportunityScore, parseInt(minOppScore as string)));
      if (maxOppScore) conditions.push(lt(leads.opportunityScore, parseInt(maxOppScore as string)));
      if (search) {
        conditions.push(or(
          ilike(leads.companyName, `%${search}%`),
          ilike(leads.website || '', `%${search}%`),
          ilike(leads.email || '', `%${search}%`)
        ) as any);
      }

      const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

      const results = await db.select()
        .from(leads)
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .where(and(...(conditions as any[])))
        .orderBy(sortOrder === 'desc' ? desc((leads as any)[sortBy as string]) : (leads as any)[sortBy as string])
        .limit(parseInt(limit as string))
        .offset(offset);
      
      res.json({ success: true, data: results.map(l => l.leads) });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Admin Data Quality View
  app.get('/api/admin/monitoring-stats', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      
      // Source Monitoring
      const sourceMetrics = await db.select({
        source: requestMetrics.source,
        status: requestMetrics.status,
        count: sql<number>`count(*)`,
        avgDuration: sql<number>`avg(duration_ms)`,
        lastRun: sql<string>`max(created_at)`
      })
      .from(requestMetrics)
      .groupBy(requestMetrics.source, requestMetrics.status);

      // Lead Quality Stats
      const leadQuality = await db.select({
        total: sql<number>`count(*)`,
        missingPhone: sql<number>`count(*) filter (where phone is null)`,
        missingWebsite: sql<number>`count(*) filter (where website is null)`,
        missingAddress: sql<number>`count(*) filter (where address is null)`,
        missingCategory: sql<number>`count(*) filter (where category is null)`,
        verifiedWebsites: sql<number>`count(*) filter (where website_status = 'verified')`,
        unreachableWebsites: sql<number>`count(*) filter (where website_status = 'unreachable')`,
        unknownWebsites: sql<number>`count(*) filter (where website_status = 'unknown')`
      }).from(leads);

      // Audit Quality
      const auditStats = await db.select({
        total: sql<number>`count(*)`,
        completed: sql<number>`count(*) filter (where status = 'completed')`,
        failed: sql<number>`count(*) filter (where status = 'failed')`,
        avgDuration: sql<number>`avg(extract(epoch from (completed_at - created_at)) * 1000)`,
        avgScore: sql<number>`avg(overall_score)`
      }).from(audits);

      // AI Quality & Costs
      const aiStats = await db.select({
        total: sql<number>`count(*)`,
        avgTokens: sql<number>`avg(token_count)`,
        totalCost: sql<number>`sum(estimated_cost)`,
        success: sql<number>`count(*) filter (where status = 'SUCCESS')`,
        failed: sql<number>`count(*) filter (where status = 'FAILURE')`
      })
      .from(requestMetrics)
      .where(eq(requestMetrics.category, 'AI'));

      // Human Reviews
      const reviewStats = await db.select({
        entityType: qualityReviews.entityType,
        isCorrect: qualityReviews.isCorrect,
        count: sql<number>`count(*)`
      })
      .from(qualityReviews)
      .groupBy(qualityReviews.entityType, qualityReviews.isCorrect);

      res.json({
        success: true,
        data: {
          sources: sourceMetrics,
          leads: leadQuality[0],
          audits: auditStats[0],
          ai: aiStats[0],
          reviews: reviewStats
        }
      });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/error-logs', async (req: AuthRequest, res) => {
    try {
      const logs = await db.select()
        .from(systemLogs)
        .orderBy(desc(systemLogs.createdAt))
        .limit(100);
      res.json({ success: true, data: logs });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/quality-reviews', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { leadId, auditId, opportunityId, aiAnalysisId, entityType, isCorrect, errorCategory, notes } = req.body;
      
      const [review] = await db.insert(qualityReviews).values({
        leadId,
        auditId,
        opportunityId,
        aiAnalysisId,
        entityType,
        isCorrect,
        errorCategory,
        notes,
        userId: user.id
      }).returning();

      res.json({ success: true, data: review });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/campaigns', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const userCampaigns = await db.select().from(campaigns).where(eq(campaigns.userId, user.id));
      res.json({ success: true, data: userCampaigns });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/campaigns', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const [newCampaign] = await db.insert(campaigns).values({
        userId: user.id,
        name: req.body.name,
        industry: req.body.industry,
        location: req.body.location,
        filters: req.body.filters || {}
      }).returning();
      res.json({ success: true, data: newCampaign });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/generate', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { sourceId, criteria, campaignName, campaignId: existingCampaignId } = req.body;
      
      let campaignId = existingCampaignId;
      if (!campaignId && campaignName) {
        const [newCampaign] = await db.insert(campaigns).values({
          userId: user.id,
          name: campaignName,
          industry: criteria.category,
          location: criteria.city || criteria.country,
        }).returning();
        campaignId = newCampaign.id;
      }

      const job = await JobService.createJob(user.id, 'LEAD_GEN', 0);
      
      // Run asynchronously
      JobService.runLeadGeneration(job.id, sourceId, criteria, campaignId).catch(console.error);

      res.json({ success: true, data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/jobs/:id', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const job = await db.query.jobs.findFirst({
        where: and(eq(jobs.id, parseInt(req.params.id)), eq(jobs.userId, user.id))
      });
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      res.json({ success: true, data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/jobs/:id/resume', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const job = await db.query.jobs.findFirst({
        where: and(eq(jobs.id, parseInt(req.params.id)), eq(jobs.userId, user.id))
      });
      if (!job) return res.status(404).json({ success: false, error: 'Job not found' });
      
      const { sourceId = 'osm', criteria, campaignId } = req.body;
      JobService.resumeLeadGeneration(job.id, sourceId, criteria, campaignId).catch(console.error);
      res.json({ success: true, message: 'Job resumed', data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/search-providers', async (_req, res) => {
    res.json({
      success: true,
      providers: SearchProviderFactory.getAllProvidersStatus(),
      primaryDiscovery: 'OpenStreetMap (Overpass API with Grid Partitioning)',
      enrichmentCrawler: 'LeadForge Native Crawler (Deep Site Scanner)'
    });
  });

  app.post('/api/leads/import', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { rows, mapping, campaignId } = req.body;
      const job = await JobService.createJob(user.id, 'CSV_IMPORT', rows.length);
      JobService.runCSVImport(job.id, rows, mapping, campaignId).catch(console.error);
      res.json({ success: true, data: job });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/admin/data-quality', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      
      const stats = await db.select({
        total: sql<number>`count(*)`,
        withWebsite: sql<number>`count(*) filter (where website is not null)`,
        verifiedWebsite: sql<number>`count(*) filter (where website_status = 'verified')`,
        unreachableWebsite: sql<number>`count(*) filter (where website_status = 'unreachable')`,
        notDetectedWebsite: sql<number>`count(*) filter (where website_status = 'not_detected')`,
        withPhone: sql<number>`count(*) filter (where phone is not null)`,
        withEmail: sql<number>`count(*) filter (where email is not null)`,
        audited: sql<number>`count(*) filter (where audit_score is not null)`,
        analyzed: sql<number>`count(*) filter (where lead_status != 'NEW')`
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(eq(campaigns.userId, user.id));

      const sourceStats = await db.select({
        source: leads.source,
        count: sql<number>`count(*)`,
        avgOppScore: sql<number>`avg(opportunity_score)`
      })
      .from(leads)
      .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
      .where(eq(campaigns.userId, user.id))
      .groupBy(leads.source);

      res.json({ success: true, data: { overall: stats[0], sources: sourceStats } });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/leads/export', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const userLeads = await db.select()
        .from(leads)
        .innerJoin(campaigns, eq(leads.campaignId, campaigns.id))
        .where(and(eq(campaigns.userId, user.id), isNull(leads.deletedAt)));
      
      const flatLeads = userLeads.map(l => l.leads);
      const csv = Papa.unparse(flatLeads);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=leads-export.csv');
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/leads/:id', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);

      const lead = await db.query.leads.findFirst({
        where: and(eq(leads.id, leadId), isNull(leads.deletedAt)),
        with: {
          campaign: true,
          opportunities: true,
          audits: {
            orderBy: (audits, { desc }) => [desc(audits.createdAt)],
            with: { findings: true }
          },
          evidence: true
        }
      });
      
      if (!lead || lead.campaign?.userId !== user.id) {
        return res.status(404).json({ success: false, error: 'Lead not found' });
      }

      res.json({ success: true, data: lead });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/leads/:id/status', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const { status, reason } = req.body;
      await CRMService.updateStatus(parseInt(req.params.id), user.id, status, reason);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/leads/:id/audit', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);
      const lead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
      
      if (!lead) return res.status(404).json({ success: false, error: 'Lead not found' });
      
      await CRMService.logActivity(leadId, user.id, 'AUDIT_STARTED', `Audit started for ${lead.website || 'discovered website'}`, 'USER');

      if (!lead.website) {
        await WebsiteService.discoverWebsite(leadId, lead.companyName, lead.city || '');
      }

      const updatedLead = await db.query.leads.findFirst({ where: eq(leads.id, leadId) });
      if (!updatedLead?.website) {
        await OpportunityService.analyzeLead(leadId);
        return res.json({ success: true, message: 'Discovery completed, no website found.' });
      }

      await WebsiteService.performAudit(leadId, updatedLead.website);
      const results = await OpportunityService.analyzeLead(leadId);
      
      await CRMService.logActivity(leadId, user.id, 'AUDIT_COMPLETED', 'Audit and opportunity analysis completed', 'SYSTEM');

      res.json({ success: true, data: results });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.get('/api/leads/:id/ai', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);
      
      const analysis = await db.query.aiAnalyses.findFirst({
        where: eq(aiAnalyses.leadId, leadId),
        orderBy: [desc(aiAnalyses.createdAt)]
      });
      
      res.json({ success: true, data: analysis ? analysis.result : null });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Rate limiting for AI
  const aiRateLimitMap = new Map<number, number>();
  const AI_RATE_LIMIT_MS = 60000; // 1 minute per lead

  app.post('/api/leads/:id/ai', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);

      // Rate limit check
      const lastRun = aiRateLimitMap.get(leadId);
      if (lastRun && Date.now() - lastRun < AI_RATE_LIMIT_MS) {
        return res.status(429).json({ success: false, error: 'AI generation limited. Please wait 1 minute.' });
      }

      const { language = 'en', tone = 'professional' } = req.body;
      const leadResult = await db.select().from(leads).innerJoin(campaigns, eq(leads.campaignId, campaigns.id)).where(and(eq(leads.id, leadId), eq(campaigns.userId, user.id)));
      if (leadResult.length === 0) return res.status(404).json({ success: false, error: 'Lead not found' });
      
      aiRateLimitMap.set(leadId, Date.now());
      const lead = leadResult[0].leads;
      const latestAudit = await db.query.audits.findFirst({ where: eq(audits.leadId, leadId), orderBy: [desc(audits.createdAt)] });
      if (!latestAudit) return res.status(400).json({ success: false, error: 'Lead must be audited before AI analysis' });

      const findings = await db.query.auditFindings.findMany({ where: eq(auditFindings.auditId, latestAudit.id) });
      const leadOpportunities = await db.query.opportunities.findMany({ where: eq(opportunities.leadId, leadId) });

      const aiInput = {
        auditId: latestAudit.id,
        lead: { companyName: lead.companyName, category: lead.category, city: lead.city, country: lead.country, address: lead.address, phone: lead.phone, email: lead.email, website: lead.website, source: lead.source },
        website: { status: lead.websiteStatus, url: lead.website, finalUrl: latestAudit.finalUrl },
        audit: { overallScore: latestAudit.overallScore, technicalScore: latestAudit.technicalScore, seoScore: latestAudit.seoScore, mobileScore: latestAudit.mobileScore, performanceScore: latestAudit.performanceScore, conversionScore: latestAudit.conversionScore, localSeoScore: latestAudit.localSeoScore },
        findings: findings.map(f => ({ category: f.category, severity: f.severity, title: f.title, evidence: f.evidence })),
        opportunities: leadOpportunities.map(o => ({ type: o.type, title: o.title, description: o.description, evidence: o.evidence }))
      };

      const analysis = await AIService.generateAnalysis(leadId, aiInput, language, tone);
      await CRMService.logActivity(leadId, user.id, 'AI_ANALYSIS_GENERATED', `AI interpretation generated (${tone}, ${language})`, 'AI');

      res.json({ success: true, data: analysis });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // CRM: Notes
  app.get('/api/leads/:id/notes', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);
      const leadNotes = await db.query.notes.findMany({
        where: eq(notes.leadId, leadId),
        orderBy: [desc(notes.createdAt)]
      });
      res.json({ success: true, data: leadNotes });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/leads/:id/notes', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const note = await CRMService.addNote(parseInt(req.params.id), user.id, req.body.content);
      res.json({ success: true, data: note });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // CRM: Activities
  app.get('/api/leads/:id/activities', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);
      const leadActivities = await db.query.activities.findMany({
        where: eq(activities.leadId, leadId),
        orderBy: [desc(activities.createdAt)]
      });
      res.json({ success: true, data: leadActivities });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/leads/:id/activities', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);
      const { type, description, metadata, origin } = req.body;
      const [activity] = await db.insert(activities).values({
        leadId,
        userId: user.id,
        type: type || 'NOTE',
        description: description || 'User activity',
        metadata: metadata || null,
        origin: origin || 'USER'
      }).returning();
      res.json({ success: true, data: activity });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // CRM: Tasks
  app.get('/api/leads/:id/tasks', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const leadId = parseInt(req.params.id);
      const leadTasks = await db.query.tasks.findMany({
        where: eq(tasks.leadId, leadId),
        orderBy: [desc(tasks.createdAt)]
      });
      res.json({ success: true, data: leadTasks });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/leads/:id/tasks', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const task = await CRMService.createTask(parseInt(req.params.id), user.id, req.body);
      res.json({ success: true, data: task });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.patch('/api/tasks/:id/complete', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const task = await CRMService.completeTask(parseInt(req.params.id), user.id);
      res.json({ success: true, data: task });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Saved Views
  app.get('/api/saved-views', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const views = await db.query.savedViews.findMany({
        where: eq(savedViews.userId, user.id)
      });
      res.json({ success: true, data: views });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  app.post('/api/saved-views', async (req: AuthRequest, res) => {
    try {
      const user = await getOrCreateUser(req.user!.uid, req.user!.email!);
      const [view] = await db.insert(savedViews).values({
        userId: user.id,
        name: req.body.name,
        filters: req.body.filters
      }).returning();
      res.json({ success: true, data: view });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // Explicit JSON 404 handler for all unmatched /api/* calls so they NEVER return HTML
  app.all('/api/*', (req, res) => {
    res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });

  if (process.env.NODE_ENV === 'development') {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
      }
      const url = req.originalUrl;
      try {
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        let html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        console.error('Vite Transformation Error:', e);
        vite.ssrFixStacktrace(e as Error);
        res.status(500).end(`
          <div style="padding: 20px; font-family: sans-serif;">
            <h1 style="color: #dc2626;">Internal Server Error (Vite)</h1>
            <p>Failed to transform HTML for the requested route.</p>
            <pre style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 12px;">${e.message}</pre>
          </div>
        `);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

startServer();
