import { pgTable, serial, text, timestamp, real, boolean, jsonb, index, integer } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique('users_uid_key'),
  email: text('email').notNull(),
  name: text('name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const campaigns = pgTable('campaigns', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  industry: text('industry'),
  location: text('location'),
  filters: jsonb('filters'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const leads = pgTable('leads', {
  id: serial('id').primaryKey(),
  campaignId: integer('campaign_id'),
  companyName: text('company_name').notNull(),
  normalizedCompanyName: text('normalized_company_name'),
  category: text('category'),
  country: text('country'),
  region: text('region'),
  city: text('city'),
  address: text('address'),
  phone: text('phone'),
  normalizedPhone: text('normalized_phone'),
  email: text('email'),
  website: text('website'),
  normalizedDomain: text('normalized_domain'),
  googleRating: real('google_rating'),
  googleReviews: integer('google_reviews'),
  latitude: real('latitude'),
  longitude: real('longitude'),
  source: text('source'),
  sourceUrl: text('source_url'),
  discoverySource: text('discovery_source'),
  enrichmentSource: text('enrichment_source'),
  websiteCandidate: text('website_candidate'),
  websiteExists: boolean('website_exists'),
  websiteStatus: text('website_status').default('unknown'),
  websiteConfidence: text('website_confidence').default('UNKNOWN'),
  websiteLastChecked: timestamp('website_last_checked'),
  dataConfidence: text('data_confidence').default('UNKNOWN'),
  auditScore: integer('audit_score'),
  opportunityScore: integer('opportunity_score'),
  leadStatus: text('lead_status').default('NEW'),
  notes: text('notes'),
  lastContactedAt: timestamp('last_contacted_at'),
  nextFollowupAt: timestamp('next_followup_at'),
  lastEnrichedAt: timestamp('last_enriched_at'),
  deletedAt: timestamp('deleted_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const audits = pgTable('audits', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  status: text('status').default('queued'),
  targetUrl: text('target_url').notNull(),
  finalUrl: text('final_url'),
  pagesAudited: integer('pages_audited').default(1),
  overallScore: integer('overall_score'),
  technicalScore: integer('technical_score'),
  seoScore: integer('seo_score'),
  mobileScore: integer('mobile_score'),
  performanceScore: integer('performance_score'),
  conversionScore: integer('conversion_score'),
  localSeoScore: integer('local_seo_score'),
  scores: jsonb('scores'),
  metrics: jsonb('metrics').notNull(),
  aiAnalysis: jsonb('ai_analysis'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  completedAt: timestamp('completed_at'),
});

export const auditFindings = pgTable('audit_findings', {
  id: serial('id').primaryKey(),
  auditId: integer('audit_id').notNull(),
  category: text('category').notNull(),
  severity: text('severity').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  evidence: text('evidence').notNull(),
  recommendation: text('recommendation'),
  confidence: text('confidence').default('UNKNOWN'),
  pageUrl: text('page_url'),
  selector: text('selector'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const fieldEvidence = pgTable('field_evidence', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  fieldName: text('field_name').notNull(),
  value: text('value'),
  source: text('source'),
  sourceUrl: text('source_url'),
  verified: boolean('verified').default(false),
  confidence: text('confidence').default('MEDIUM'),
  checkedAt: timestamp('checked_at').defaultNow(),
});

export const jobs = pgTable('jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  type: text('type').notNull(),
  status: text('status').default('queued'),
  progress: integer('progress').default(0),
  total: integer('total').default(0),
  results: jsonb('results'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const sourceRuns = pgTable('source_runs', {
  id: serial('id').primaryKey(),
  source: text('source').notNull(),
  query: jsonb('query'),
  resultsCount: integer('results_count').default(0),
  status: text('status').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const opportunities = pgTable('opportunities', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  auditId: integer('audit_id'),
  type: text('type').notNull(),
  title: text('title').notNull(),
  description: text('description').notNull(),
  severity: text('severity').notNull(),
  evidence: text('evidence').notNull(),
  confidence: text('confidence').notNull(),
  recommendedService: text('recommended_service'),
  status: text('status').default('NEW'),
  score: integer('score').default(0),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const aiAnalyses = pgTable('ai_analyses', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  auditId: integer('audit_id'),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  inputHash: text('input_hash').notNull(),
  result: jsonb('result').notNull(),
  language: text('language').default('en'),
  tone: text('tone').default('professional'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const activities = pgTable('activities', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  type: text('type').notNull(),
  description: text('description').notNull(),
  metadata: jsonb('metadata'),
  origin: text('origin').default('SYSTEM'),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const notes = pgTable('notes', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  userId: integer('user_id').notNull(),
  content: text('content').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id').notNull(),
  userId: integer('user_id').notNull(),
  title: text('title').notNull(),
  dueDate: timestamp('due_date'),
  priority: text('priority').default('MEDIUM'),
  status: text('status').default('TODO'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const savedViews = pgTable('saved_views', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  name: text('name').notNull(),
  filters: jsonb('filters').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const systemLogs = pgTable('system_logs', {
  id: serial('id').primaryKey(),
  level: text('level').default('INFO'),
  component: text('component').notNull(),
  source: text('source'),
  message: text('message').notNull(),
  errorType: text('error_type'),
  metadata: jsonb('metadata'),
  requestId: text('request_id'),
  retryCount: integer('retry_count').default(0),
  createdAt: timestamp('created_at').defaultNow(),
});

export const requestMetrics = pgTable('request_metrics', {
  id: serial('id').primaryKey(),
  category: text('category').notNull(),
  source: text('source').notNull(),
  status: text('status').notNull(),
  durationMs: integer('duration_ms'),
  tokenCount: integer('token_count'),
  estimatedCost: real('estimated_cost'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const qualityReviews = pgTable('quality_reviews', {
  id: serial('id').primaryKey(),
  leadId: integer('lead_id'),
  auditId: integer('audit_id'),
  opportunityId: integer('opportunity_id'),
  aiAnalysisId: integer('ai_analysis_id'),
  entityType: text('entity_type').notNull(),
  isCorrect: boolean('is_correct').notNull(),
  errorCategory: text('error_category'),
  notes: text('notes'),
  userId: integer('user_id').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const usersRelations = relations(users, ({ many }) => ({
  campaigns: many(campaigns),
  qualityReviews: many(qualityReviews),
}));

export const campaignsRelations = relations(campaigns, ({ one, many }) => ({
  user: one(users, { fields: [campaigns.userId], references: [users.id] }),
  leads: many(leads),
}));

export const leadsRelations = relations(leads, ({ one, many }) => ({
  campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
  audits: many(audits),
  evidence: many(fieldEvidence),
  opportunities: many(opportunities),
  qualityReviews: many(qualityReviews),
}));

export const auditsRelations = relations(audits, ({ one, many }) => ({
  lead: one(leads, { fields: [audits.leadId], references: [leads.id] }),
  findings: many(auditFindings),
  opportunities: many(opportunities),
  qualityReviews: many(qualityReviews),
}));

export const auditFindingsRelations = relations(auditFindings, ({ one }) => ({
  audit: one(audits, { fields: [auditFindings.auditId], references: [audits.id] }),
}));

export const fieldEvidenceRelations = relations(fieldEvidence, ({ one }) => ({
  lead: one(leads, { fields: [fieldEvidence.leadId], references: [leads.id] }),
}));

export const opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
  lead: one(leads, { fields: [opportunities.leadId], references: [leads.id] }),
  audit: one(audits, { fields: [opportunities.auditId], references: [audits.id] }),
  qualityReviews: many(qualityReviews),
}));

export const aiAnalysesRelations = relations(aiAnalyses, ({ one, many }) => ({
  lead: one(leads, { fields: [aiAnalyses.leadId], references: [leads.id] }),
  audit: one(audits, { fields: [aiAnalyses.auditId], references: [audits.id] }),
  qualityReviews: many(qualityReviews),
}));

export const qualityReviewsRelations = relations(qualityReviews, ({ one }) => ({
  user: one(users, { fields: [qualityReviews.userId], references: [users.id] }),
  lead: one(leads, { fields: [qualityReviews.leadId], references: [leads.id] }),
  audit: one(audits, { fields: [qualityReviews.auditId], references: [audits.id] }),
  opportunity: one(opportunities, { fields: [qualityReviews.opportunityId], references: [opportunities.id] }),
  aiAnalysis: one(aiAnalyses, { fields: [qualityReviews.aiAnalysisId], references: [aiAnalyses.id] }),
}));

export const activitiesRelations = relations(activities, ({ one }) => ({
  lead: one(leads, { fields: [activities.leadId], references: [leads.id] }),
  user: one(users, { fields: [activities.userId], references: [users.id] }),
}));

export const notesRelations = relations(notes, ({ one }) => ({
  lead: one(leads, { fields: [notes.leadId], references: [leads.id] }),
  user: one(users, { fields: [notes.userId], references: [users.id] }),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
  user: one(users, { fields: [tasks.userId], references: [users.id] }),
}));

export const savedViewsRelations = relations(savedViews, ({ one }) => ({
  user: one(users, { fields: [savedViews.userId], references: [users.id] }),
}));

