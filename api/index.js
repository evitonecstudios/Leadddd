var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  activities: () => activities,
  activitiesRelations: () => activitiesRelations,
  aiAnalyses: () => aiAnalyses,
  aiAnalysesRelations: () => aiAnalysesRelations,
  auditFindings: () => auditFindings,
  auditFindingsRelations: () => auditFindingsRelations,
  audits: () => audits,
  auditsRelations: () => auditsRelations,
  campaigns: () => campaigns,
  campaignsRelations: () => campaignsRelations,
  fieldEvidence: () => fieldEvidence,
  fieldEvidenceRelations: () => fieldEvidenceRelations,
  jobs: () => jobs,
  leads: () => leads,
  leadsRelations: () => leadsRelations,
  notes: () => notes,
  notesRelations: () => notesRelations,
  opportunities: () => opportunities,
  opportunitiesRelations: () => opportunitiesRelations,
  qualityReviews: () => qualityReviews,
  qualityReviewsRelations: () => qualityReviewsRelations,
  requestMetrics: () => requestMetrics,
  savedViews: () => savedViews,
  savedViewsRelations: () => savedViewsRelations,
  sourceRuns: () => sourceRuns,
  systemLogs: () => systemLogs,
  tasks: () => tasks,
  tasksRelations: () => tasksRelations,
  users: () => users,
  usersRelations: () => usersRelations
});
import { pgTable, serial, text, timestamp, real, boolean, jsonb, integer } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
var users, campaigns, leads, audits, auditFindings, fieldEvidence, jobs, sourceRuns, opportunities, aiAnalyses, activities, notes, tasks, savedViews, systemLogs, requestMetrics, qualityReviews, usersRelations, campaignsRelations, leadsRelations, auditsRelations, auditFindingsRelations, fieldEvidenceRelations, opportunitiesRelations, aiAnalysesRelations, qualityReviewsRelations, activitiesRelations, notesRelations, tasksRelations, savedViewsRelations;
var init_schema = __esm({
  "src/db/schema.ts"() {
    "use strict";
    users = pgTable("users", {
      id: serial("id").primaryKey(),
      uid: text("uid").notNull().unique("users_uid_key"),
      email: text("email").notNull(),
      name: text("name"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    campaigns = pgTable("campaigns", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull(),
      name: text("name").notNull(),
      industry: text("industry"),
      location: text("location"),
      filters: jsonb("filters"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    leads = pgTable("leads", {
      id: serial("id").primaryKey(),
      campaignId: integer("campaign_id"),
      companyName: text("company_name").notNull(),
      normalizedCompanyName: text("normalized_company_name"),
      category: text("category"),
      country: text("country"),
      region: text("region"),
      city: text("city"),
      address: text("address"),
      phone: text("phone"),
      normalizedPhone: text("normalized_phone"),
      email: text("email"),
      website: text("website"),
      normalizedDomain: text("normalized_domain"),
      googleRating: real("google_rating"),
      googleReviews: integer("google_reviews"),
      latitude: real("latitude"),
      longitude: real("longitude"),
      source: text("source"),
      sourceUrl: text("source_url"),
      discoverySource: text("discovery_source"),
      enrichmentSource: text("enrichment_source"),
      websiteCandidate: text("website_candidate"),
      websiteExists: boolean("website_exists"),
      websiteStatus: text("website_status").default("unknown"),
      websiteConfidence: text("website_confidence").default("UNKNOWN"),
      websiteLastChecked: timestamp("website_last_checked", { withTimezone: true }),
      dataConfidence: text("data_confidence").default("UNKNOWN"),
      auditScore: integer("audit_score"),
      opportunityScore: integer("opportunity_score"),
      leadStatus: text("lead_status").default("NEW"),
      notes: text("notes"),
      lastContactedAt: timestamp("last_contacted_at", { withTimezone: true }),
      nextFollowupAt: timestamp("next_followup_at", { withTimezone: true }),
      lastEnrichedAt: timestamp("last_enriched_at", { withTimezone: true }),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    audits = pgTable("audits", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      status: text("status").default("queued"),
      targetUrl: text("target_url").notNull(),
      finalUrl: text("final_url"),
      pagesAudited: integer("pages_audited").default(1),
      overallScore: integer("overall_score"),
      technicalScore: integer("technical_score"),
      seoScore: integer("seo_score"),
      mobileScore: integer("mobile_score"),
      performanceScore: integer("performance_score"),
      conversionScore: integer("conversion_score"),
      localSeoScore: integer("local_seo_score"),
      scores: jsonb("scores"),
      metrics: jsonb("metrics").notNull(),
      aiAnalysis: jsonb("ai_analysis"),
      error: text("error"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      completedAt: timestamp("completed_at", { withTimezone: true })
    });
    auditFindings = pgTable("audit_findings", {
      id: serial("id").primaryKey(),
      auditId: integer("audit_id").notNull(),
      category: text("category").notNull(),
      severity: text("severity").notNull(),
      title: text("title").notNull(),
      description: text("description").notNull(),
      evidence: text("evidence").notNull(),
      recommendation: text("recommendation"),
      confidence: text("confidence").default("UNKNOWN"),
      pageUrl: text("page_url"),
      selector: text("selector"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    fieldEvidence = pgTable("field_evidence", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      fieldName: text("field_name").notNull(),
      value: text("value"),
      source: text("source"),
      sourceUrl: text("source_url"),
      verified: boolean("verified").default(false),
      confidence: text("confidence").default("MEDIUM"),
      checkedAt: timestamp("checked_at", { withTimezone: true }).defaultNow()
    });
    jobs = pgTable("jobs", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull(),
      type: text("type").notNull(),
      status: text("status").default("queued"),
      progress: integer("progress").default(0),
      total: integer("total").default(0),
      results: jsonb("results"),
      error: text("error"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    sourceRuns = pgTable("source_runs", {
      id: serial("id").primaryKey(),
      source: text("source").notNull(),
      query: jsonb("query"),
      resultsCount: integer("results_count").default(0),
      status: text("status").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    opportunities = pgTable("opportunities", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      auditId: integer("audit_id"),
      type: text("type").notNull(),
      title: text("title").notNull(),
      description: text("description").notNull(),
      severity: text("severity").notNull(),
      evidence: text("evidence").notNull(),
      confidence: text("confidence").notNull(),
      recommendedService: text("recommended_service"),
      status: text("status").default("NEW"),
      score: integer("score").default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    aiAnalyses = pgTable("ai_analyses", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      auditId: integer("audit_id"),
      model: text("model").notNull(),
      promptVersion: text("prompt_version").notNull(),
      inputHash: text("input_hash").notNull(),
      result: jsonb("result").notNull(),
      language: text("language").default("en"),
      tone: text("tone").default("professional"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    activities = pgTable("activities", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      type: text("type").notNull(),
      description: text("description").notNull(),
      metadata: jsonb("metadata"),
      origin: text("origin").default("SYSTEM"),
      userId: integer("user_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    notes = pgTable("notes", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      userId: integer("user_id").notNull(),
      content: text("content").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    tasks = pgTable("tasks", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id").notNull(),
      userId: integer("user_id").notNull(),
      title: text("title").notNull(),
      dueDate: timestamp("due_date", { withTimezone: true }),
      priority: text("priority").default("MEDIUM"),
      status: text("status").default("TODO"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    savedViews = pgTable("saved_views", {
      id: serial("id").primaryKey(),
      userId: integer("user_id").notNull(),
      name: text("name").notNull(),
      filters: jsonb("filters").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow()
    });
    systemLogs = pgTable("system_logs", {
      id: serial("id").primaryKey(),
      level: text("level").default("INFO"),
      component: text("component").notNull(),
      source: text("source"),
      message: text("message").notNull(),
      errorType: text("error_type"),
      metadata: jsonb("metadata"),
      requestId: text("request_id"),
      retryCount: integer("retry_count").default(0),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    requestMetrics = pgTable("request_metrics", {
      id: serial("id").primaryKey(),
      category: text("category").notNull(),
      source: text("source").notNull(),
      status: text("status").notNull(),
      durationMs: integer("duration_ms"),
      tokenCount: integer("token_count"),
      estimatedCost: real("estimated_cost"),
      metadata: jsonb("metadata"),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    qualityReviews = pgTable("quality_reviews", {
      id: serial("id").primaryKey(),
      leadId: integer("lead_id"),
      auditId: integer("audit_id"),
      opportunityId: integer("opportunity_id"),
      aiAnalysisId: integer("ai_analysis_id"),
      entityType: text("entity_type").notNull(),
      isCorrect: boolean("is_correct").notNull(),
      errorCategory: text("error_category"),
      notes: text("notes"),
      userId: integer("user_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true }).defaultNow()
    });
    usersRelations = relations(users, ({ many }) => ({
      campaigns: many(campaigns),
      qualityReviews: many(qualityReviews)
    }));
    campaignsRelations = relations(campaigns, ({ one, many }) => ({
      user: one(users, { fields: [campaigns.userId], references: [users.id] }),
      leads: many(leads)
    }));
    leadsRelations = relations(leads, ({ one, many }) => ({
      campaign: one(campaigns, { fields: [leads.campaignId], references: [campaigns.id] }),
      audits: many(audits),
      evidence: many(fieldEvidence),
      opportunities: many(opportunities),
      qualityReviews: many(qualityReviews)
    }));
    auditsRelations = relations(audits, ({ one, many }) => ({
      lead: one(leads, { fields: [audits.leadId], references: [leads.id] }),
      findings: many(auditFindings),
      opportunities: many(opportunities),
      qualityReviews: many(qualityReviews)
    }));
    auditFindingsRelations = relations(auditFindings, ({ one }) => ({
      audit: one(audits, { fields: [auditFindings.auditId], references: [audits.id] })
    }));
    fieldEvidenceRelations = relations(fieldEvidence, ({ one }) => ({
      lead: one(leads, { fields: [fieldEvidence.leadId], references: [leads.id] })
    }));
    opportunitiesRelations = relations(opportunities, ({ one, many }) => ({
      lead: one(leads, { fields: [opportunities.leadId], references: [leads.id] }),
      audit: one(audits, { fields: [opportunities.auditId], references: [audits.id] }),
      qualityReviews: many(qualityReviews)
    }));
    aiAnalysesRelations = relations(aiAnalyses, ({ one, many }) => ({
      lead: one(leads, { fields: [aiAnalyses.leadId], references: [leads.id] }),
      audit: one(audits, { fields: [aiAnalyses.auditId], references: [audits.id] }),
      qualityReviews: many(qualityReviews)
    }));
    qualityReviewsRelations = relations(qualityReviews, ({ one }) => ({
      user: one(users, { fields: [qualityReviews.userId], references: [users.id] }),
      lead: one(leads, { fields: [qualityReviews.leadId], references: [leads.id] }),
      audit: one(audits, { fields: [qualityReviews.auditId], references: [audits.id] }),
      opportunity: one(opportunities, { fields: [qualityReviews.opportunityId], references: [opportunities.id] }),
      aiAnalysis: one(aiAnalyses, { fields: [qualityReviews.aiAnalysisId], references: [aiAnalyses.id] })
    }));
    activitiesRelations = relations(activities, ({ one }) => ({
      lead: one(leads, { fields: [activities.leadId], references: [leads.id] }),
      user: one(users, { fields: [activities.userId], references: [users.id] })
    }));
    notesRelations = relations(notes, ({ one }) => ({
      lead: one(leads, { fields: [notes.leadId], references: [leads.id] }),
      user: one(users, { fields: [notes.userId], references: [users.id] })
    }));
    tasksRelations = relations(tasks, ({ one }) => ({
      lead: one(leads, { fields: [tasks.leadId], references: [leads.id] }),
      user: one(users, { fields: [tasks.userId], references: [users.id] })
    }));
    savedViewsRelations = relations(savedViews, ({ one }) => ({
      user: one(users, { fields: [savedViews.userId], references: [users.id] })
    }));
  }
});

// src/db/schemaDdl.ts
var SCHEMA_SQL;
var init_schemaDdl = __esm({
  "src/db/schemaDdl.ts"() {
    "use strict";
    SCHEMA_SQL = `
-- 1. Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  uid TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Campaigns table
CREATE TABLE IF NOT EXISTS campaigns (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  industry TEXT,
  location TEXT,
  filters JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Leads table
CREATE TABLE IF NOT EXISTS leads (
  id SERIAL PRIMARY KEY,
  campaign_id INTEGER REFERENCES campaigns(id) ON DELETE SET NULL,
  company_name TEXT NOT NULL,
  normalized_company_name TEXT,
  category TEXT,
  country TEXT,
  region TEXT,
  city TEXT,
  address TEXT,
  phone TEXT,
  normalized_phone TEXT,
  email TEXT,
  website TEXT,
  normalized_domain TEXT,
  google_rating REAL,
  google_reviews INTEGER,
  latitude REAL,
  longitude REAL,
  source TEXT,
  source_url TEXT,
  discovery_source TEXT,
  enrichment_source TEXT,
  website_candidate TEXT,
  website_exists BOOLEAN,
  website_status TEXT DEFAULT 'unknown',
  website_confidence TEXT DEFAULT 'UNKNOWN',
  website_last_checked TIMESTAMP WITH TIME ZONE,
  data_confidence TEXT DEFAULT 'UNKNOWN',
  audit_score INTEGER,
  opportunity_score INTEGER,
  lead_status TEXT DEFAULT 'NEW',
  notes TEXT,
  last_contacted_at TIMESTAMP WITH TIME ZONE,
  next_followup_at TIMESTAMP WITH TIME ZONE,
  last_enriched_at TIMESTAMP WITH TIME ZONE,
  deleted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Audits table
CREATE TABLE IF NOT EXISTS audits (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'queued',
  target_url TEXT NOT NULL,
  final_url TEXT,
  pages_audited INTEGER DEFAULT 1,
  overall_score INTEGER,
  technical_score INTEGER,
  seo_score INTEGER,
  mobile_score INTEGER,
  performance_score INTEGER,
  conversion_score INTEGER,
  local_seo_score INTEGER,
  scores JSONB,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  ai_analysis JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- 5. Audit Findings table
CREATE TABLE IF NOT EXISTS audit_findings (
  id SERIAL PRIMARY KEY,
  audit_id INTEGER NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  evidence TEXT NOT NULL,
  recommendation TEXT,
  confidence TEXT DEFAULT 'UNKNOWN',
  page_url TEXT,
  selector TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 6. Field Evidence table
CREATE TABLE IF NOT EXISTS field_evidence (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  field_name TEXT NOT NULL,
  value TEXT,
  source TEXT,
  source_url TEXT,
  verified BOOLEAN DEFAULT FALSE,
  confidence TEXT DEFAULT 'MEDIUM',
  checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Jobs table
CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  progress INTEGER DEFAULT 0,
  total INTEGER DEFAULT 0,
  results JSONB,
  error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Source Runs table
CREATE TABLE IF NOT EXISTS source_runs (
  id SERIAL PRIMARY KEY,
  source TEXT NOT NULL,
  query JSONB,
  results_count INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. Opportunities table
CREATE TABLE IF NOT EXISTS opportunities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  audit_id INTEGER REFERENCES audits(id) ON DELETE SET NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  severity TEXT NOT NULL,
  evidence TEXT NOT NULL,
  confidence TEXT NOT NULL,
  recommended_service TEXT,
  status TEXT DEFAULT 'NEW',
  score INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. AI Analyses table
CREATE TABLE IF NOT EXISTS ai_analyses (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  audit_id INTEGER REFERENCES audits(id) ON DELETE SET NULL,
  model TEXT NOT NULL,
  prompt_version TEXT NOT NULL,
  input_hash TEXT NOT NULL,
  result JSONB NOT NULL,
  language TEXT DEFAULT 'en',
  tone TEXT DEFAULT 'professional',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Activities table
CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB,
  origin TEXT DEFAULT 'SYSTEM',
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Notes table
CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 13. Tasks table
CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  priority TEXT DEFAULT 'MEDIUM',
  status TEXT DEFAULT 'TODO',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 14. Saved Views table
CREATE TABLE IF NOT EXISTS saved_views (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  filters JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 15. System Logs table
CREATE TABLE IF NOT EXISTS system_logs (
  id SERIAL PRIMARY KEY,
  level TEXT DEFAULT 'INFO',
  component TEXT NOT NULL,
  source TEXT,
  message TEXT NOT NULL,
  error_type TEXT,
  metadata JSONB,
  request_id TEXT,
  retry_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 16. Request Metrics table
CREATE TABLE IF NOT EXISTS request_metrics (
  id SERIAL PRIMARY KEY,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  status TEXT NOT NULL,
  duration_ms INTEGER,
  token_count INTEGER,
  estimated_cost REAL,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 17. Quality Reviews table
CREATE TABLE IF NOT EXISTS quality_reviews (
  id SERIAL PRIMARY KEY,
  lead_id INTEGER REFERENCES leads(id) ON DELETE CASCADE,
  audit_id INTEGER REFERENCES audits(id) ON DELETE SET NULL,
  opportunity_id INTEGER REFERENCES opportunities(id) ON DELETE SET NULL,
  ai_analysis_id INTEGER REFERENCES ai_analyses(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL,
  is_correct BOOLEAN NOT NULL,
  error_category TEXT,
  notes TEXT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_leads_campaign_id ON leads(campaign_id);
CREATE INDEX IF NOT EXISTS idx_leads_lead_status ON leads(lead_status);
CREATE INDEX IF NOT EXISTS idx_leads_opportunity_score ON leads(opportunity_score);
CREATE INDEX IF NOT EXISTS idx_opportunities_lead_id ON opportunities(lead_id);
CREATE INDEX IF NOT EXISTS idx_audits_lead_id ON audits(lead_id);
CREATE INDEX IF NOT EXISTS idx_audit_findings_audit_id ON audit_findings(audit_id);
CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs(user_id);
CREATE INDEX IF NOT EXISTS idx_activities_lead_id ON activities(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_lead_id ON tasks(lead_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_views_user_id ON saved_views(user_id);
`;
  }
});

// src/db/index.ts
var db_exports = {};
__export(db_exports, {
  checkDbHealth: () => checkDbHealth,
  createPool: () => createPool,
  db: () => db,
  getConnectionString: () => getConnectionString,
  initDatabaseSchema: () => initDatabaseSchema
});
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
async function initDatabaseSchema() {
  const p = createPool();
  try {
    await p.query(SCHEMA_SQL);
    console.log("[DB-INIT] Successfully applied schema DDL (17 tables + indexes)");
    return { success: true, message: "All 17 database tables and indexes initialized successfully." };
  } catch (err) {
    console.error("[DB-INIT] Failed to apply schema DDL:", err);
    return { success: false, error: err.message };
  }
}
async function checkDbHealth() {
  const p = createPool();
  const connString = getConnectionString();
  let hostInfo = "localhost";
  let portInfo = "5432";
  let isSupabasePooler = false;
  let isDirectSupabase = false;
  if (connString) {
    try {
      const match = connString.match(/@([^:/]+)(?::(\d+))?/);
      if (match) {
        hostInfo = match[1];
        portInfo = match[2] || "5432";
      }
      isSupabasePooler = hostInfo.includes("pooler.supabase.com") || portInfo === "6543";
      isDirectSupabase = hostInfo.includes("supabase.co") && portInfo === "5432";
    } catch {
    }
  }
  const result = {
    success: false,
    connected: false,
    fullyProvisioned: false,
    tables: 0,
    error: null,
    code: null,
    diagnostics: {
      hasConnectionString: Boolean(connString),
      detectedHost: hostInfo,
      detectedPort: portInfo,
      isSupabasePooler,
      isDirectSupabaseWarning: isDirectSupabase ? "Direct Supabase connection (port 5432) uses IPv6 which fails on Vercel. Switch to Connection Pooler (port 6543)." : null,
      recommendation: null
    }
  };
  if (!connString && (process.env.VERCEL || process.env.NODE_ENV === "production")) {
    result.error = "DATABASE_URL environment variable is not defined.";
    result.code = "NO_DATABASE_URL";
    result.diagnostics.recommendation = "In Vercel -> Project Settings -> Environment Variables, add DATABASE_URL (Supabase Transaction Pooler port 6543), then trigger a Redeploy.";
    return result;
  }
  try {
    const res = await p.query("SELECT 1");
    result.connected = res.rowCount === 1;
    result.success = result.connected;
    const tableRes = await p.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    result.tables = parseInt(tableRes.rows[0].count);
    if (result.connected && result.tables < 5) {
      console.log(`[DB-HEALTH] Database has only ${result.tables} tables. Attempting auto-provisioning...`);
      const initRes = await initDatabaseSchema();
      if (initRes.success) {
        const recheck = await p.query(`
          SELECT count(*) FROM information_schema.tables 
          WHERE table_schema = 'public'
        `);
        result.tables = parseInt(recheck.rows[0].count);
      }
    }
    result.fullyProvisioned = result.tables >= 10;
    return result;
  } catch (err) {
    result.error = err.message;
    result.code = err.code;
    if (err.code === "ECONNREFUSED") {
      result.diagnostics.recommendation = "Connection refused. If on Vercel, localhost is not available. Please set DATABASE_URL with a cloud database (e.g. Supabase or Neon).";
    } else if (err.code === "ETIMEDOUT") {
      result.diagnostics.recommendation = "Connection timed out. On Supabase, use the Transaction Pooler URL (port 6543 with aws-0-*.pooler.supabase.com), not direct port 5432.";
    } else if (err.code === "28P01" || err.message?.includes("password")) {
      result.diagnostics.recommendation = "Password authentication failed. Check your database password. If it contains special characters (@, #, !, $), URL-encode them (e.g., %40).";
    } else if (err.code === "ENOTFOUND") {
      result.diagnostics.recommendation = "Host address not found. Double check your DATABASE_URL host domain.";
    }
    return result;
  }
}
var fullSchema, getConnectionString, createPool, pool, db;
var init_db = __esm({
  "src/db/index.ts"() {
    "use strict";
    init_schema();
    init_schemaDdl();
    fullSchema = { ...schema_exports };
    getConnectionString = () => {
      const raw = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL || process.env.SUPABASE_DB_URL || process.env.DB_URL;
      if (!raw) return void 0;
      return raw.trim().replace(/^["']|["']$/g, "");
    };
    createPool = () => {
      if (!global._postgresPool) {
        if (process.env.SQL_HOST) {
          global._postgresPool = new Pool({
            host: process.env.SQL_HOST,
            user: process.env.SQL_USER,
            password: process.env.SQL_PASSWORD,
            database: process.env.SQL_DB_NAME,
            max: 10,
            connectionTimeoutMillis: 1e4
          });
        } else {
          const connString = getConnectionString();
          if (connString) {
            const isLocal = connString.includes("localhost") || connString.includes("127.0.0.1");
            global._postgresPool = new Pool({
              connectionString: connString,
              ssl: isLocal ? false : { rejectUnauthorized: false },
              max: process.env.VERCEL ? 3 : 10,
              connectionTimeoutMillis: 5e3,
              idleTimeoutMillis: 3e4
            });
          } else {
            global._postgresPool = new Pool({
              host: "localhost",
              database: "postgres",
              max: 5,
              connectionTimeoutMillis: 3e3
            });
          }
        }
        global._postgresPool.on("error", (err) => {
          console.error("[DB-POOL] Unexpected error on idle SQL pool client:", err);
        });
      }
      return global._postgresPool;
    };
    createPool();
    pool = global._postgresPool;
    db = drizzle(pool, { schema: fullSchema });
  }
});

// src/services/gridPartitionService.ts
var gridPartitionService_exports = {};
__export(gridPartitionService_exports, {
  GridPartitionService: () => GridPartitionService
});
import axios2 from "axios";
var GridPartitionService;
var init_gridPartitionService = __esm({
  "src/services/gridPartitionService.ts"() {
    "use strict";
    GridPartitionService = class {
      /**
       * Subdivides a bounding box into a grid of cells.
       * @param bbox The master bounding box to subdivide.
       * @param divisions The number of divisions per axis (e.g., 2 means 4 cells).
       */
      static partition(bbox, divisions = 2) {
        const cells = [];
        const latStep = (bbox.maxLat - bbox.minLat) / divisions;
        const lonStep = (bbox.maxLon - bbox.minLon) / divisions;
        for (let i = 0; i < divisions; i++) {
          for (let j = 0; j < divisions; j++) {
            cells.push({
              minLat: bbox.minLat + i * latStep,
              maxLat: bbox.minLat + (i + 1) * latStep,
              minLon: bbox.minLon + j * lonStep,
              maxLon: bbox.minLon + (j + 1) * lonStep
            });
          }
        }
        return cells;
      }
      /**
       * Attempts to get a bounding box for a city/country name using Nominatim.
       */
      static async getBoundingBox(location) {
        try {
          const cleanLocation = location?.trim();
          if (!cleanLocation) return null;
          const response = await axios2.get("https://nominatim.openstreetmap.org/search", {
            params: {
              q: cleanLocation,
              format: "json",
              limit: 1
            },
            headers: {
              "User-Agent": "LeadForge-Discovery-Engine/1.0"
            },
            timeout: 1e4
          });
          if (response.data && response.data.length > 0) {
            const item = response.data[0];
            const boundingbox = item.boundingbox;
            return {
              minLat: parseFloat(boundingbox[0]),
              maxLat: parseFloat(boundingbox[1]),
              minLon: parseFloat(boundingbox[2]),
              maxLon: parseFloat(boundingbox[3])
            };
          }
          return null;
        } catch (error) {
          console.error("Failed to fetch bounding box for location:", location, error);
          return null;
        }
      }
      /**
       * Decides on the number of divisions based on the area size or target count.
       */
      static calculateDivisions(bbox, targetCount) {
        const latDiff = bbox.maxLat - bbox.minLat;
        const lonDiff = bbox.maxLon - bbox.minLon;
        const area = latDiff * lonDiff;
        if (area > 5) return 8;
        if (area > 1) return 6;
        if (area > 0.3) return 4;
        if (targetCount <= 30) return 1;
        if (targetCount <= 80) return 2;
        if (targetCount <= 200) return 3;
        if (targetCount <= 500) return 4;
        return 5;
      }
      /**
       * Expands a bounding box by a multiplier while keeping it centered.
       * multiplier 1.5 = 50% larger on each axis.
       */
      static expandBoundingBox(bbox, multiplier) {
        const latDiff = bbox.maxLat - bbox.minLat;
        const lonDiff = bbox.maxLon - bbox.minLon;
        const centerLat = (bbox.minLat + bbox.maxLat) / 2;
        const centerLon = (bbox.minLon + bbox.maxLon) / 2;
        const halfLat = latDiff * multiplier / 2;
        const halfLon = lonDiff * multiplier / 2;
        return {
          minLat: centerLat - halfLat,
          maxLat: centerLat + halfLat,
          minLon: centerLon - halfLon,
          maxLon: centerLon + halfLon
        };
      }
    };
  }
});

// src/app.ts
import express from "express";
import path2 from "path";
import { fileURLToPath as fileURLToPath2 } from "url";
import * as dotenv from "dotenv";

// src/lib/firebase-admin.ts
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
var __filename = fileURLToPath(import.meta.url);
var __dirname = path.dirname(__filename);
var firebaseConfig = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    firebaseConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (error) {
  console.warn("[FIREBASE-ADMIN] Could not load config from disk, relying on env vars.");
}
var DEFAULT_PROJECT_ID = "majestic-safeguard-nvr20";
var getAdminAuth = () => {
  if (!getApps().length) {
    try {
      const projectId = process.env.VITE_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID || firebaseConfig.projectId || process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;
      console.log(`[FIREBASE-ADMIN] Initialization with Project ID: ${projectId}`);
      initializeApp({
        projectId
      });
    } catch (error) {
      console.error("[FIREBASE-ADMIN] Initialization error:", error.message);
    }
  }
  return getAuth();
};
var adminAuth = {
  verifyIdToken: async (token) => {
    try {
      const auth = getAdminAuth();
      return await auth.verifyIdToken(token);
    } catch (error) {
      console.error("[FIREBASE-ADMIN] Token verification error:", error.message);
      throw error;
    }
  }
};

// src/middleware/auth.ts
var requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized: Missing token" });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    req.user = decodedToken;
    next();
  } catch (error) {
    if (error?.code === "auth/id-token-expired") {
      console.warn("Firebase ID token has expired. Prompting client for fresh token.");
      return res.status(401).json({
        error: "TOKEN_EXPIRED",
        message: "Firebase ID token has expired. Please refresh your token."
      });
    }
    console.error("Error verifying Firebase ID token:", error);
    return res.status(401).json({ error: "Unauthorized: Invalid token" });
  }
};

// src/db/users.ts
init_db();
init_schema();
import { eq } from "drizzle-orm";
async function getOrCreateUser(uid, email, name) {
  try {
    let existing = await db.query.users.findFirst({
      where: eq(users.uid, uid)
    });
    if (existing) return existing;
    existing = await db.query.users.findFirst({
      where: eq(users.email, email)
    });
    if (existing) {
      const [updated] = await db.update(users).set({ uid, name: name || existing.name }).where(eq(users.id, existing.id)).returning();
      return updated;
    }
    if (email && (email.startsWith("evitonec") || email.includes("evitonec"))) {
      const ownerUser = await db.query.users.findFirst({
        where: eq(users.id, 12)
      });
      if (ownerUser) {
        const [updated] = await db.update(users).set({ uid, email, name: name || ownerUser.name }).where(eq(users.id, 12)).returning();
        return updated;
      }
    }
    const [newUser] = await db.insert(users).values({
      uid,
      email,
      name
    }).returning();
    return newUser;
  } catch (error) {
    console.error("Failed to get or create user:", error);
    throw error;
  }
}

// src/services/websiteService.ts
init_db();
init_schema();
import axios from "axios";
import * as cheerio from "cheerio";
import https from "https";
import { eq as eq2 } from "drizzle-orm";

// src/lib/monitoring.ts
init_db();
init_schema();
var logger = {
  info: async (component, message, metadata, source, requestId) => {
    try {
      await db.insert(systemLogs).values({
        level: "INFO",
        component,
        message,
        metadata,
        source,
        requestId
      });
    } catch (error) {
      console.error("Failed to write log to DB:", error);
    }
  },
  warn: async (component, message, metadata, source, requestId) => {
    try {
      await db.insert(systemLogs).values({
        level: "WARN",
        component,
        message,
        metadata,
        source,
        requestId
      });
    } catch (error) {
      console.error("Failed to write log to DB:", error);
    }
  },
  error: async (component, message, error, metadata, source, requestId, retryCount) => {
    try {
      await db.insert(systemLogs).values({
        level: "ERROR",
        component,
        message,
        errorType: error instanceof Error ? error.name : typeof error === "string" ? error : void 0,
        metadata: {
          errorMessage: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : void 0,
          ...metadata
        },
        source,
        requestId,
        retryCount
      });
    } catch (err) {
      console.error("Failed to write log to DB:", err);
    }
  }
};
var metrics = {
  record: async (category, source, status, durationMs, metadata, tokenCount, estimatedCost) => {
    try {
      await db.insert(requestMetrics).values({
        category,
        source,
        status,
        durationMs,
        tokenCount,
        estimatedCost,
        metadata
      });
    } catch (error) {
      console.error("Failed to record metric to DB:", error);
    }
  }
};
var AI_COSTS = {
  "gemini-1.5-flash": {
    input: 125e-6 / 1e3,
    output: 375e-6 / 1e3
  },
  "gemini-1.5-pro": {
    input: 35e-4 / 1e3,
    output: 0.0105 / 1e3
  },
  "gemini-3.8-flash": {
    input: 1e-4 / 1e3,
    // Estimated
    output: 3e-4 / 1e3
    // Estimated
  }
};
function estimateAiCost(model, inputTokens, outputTokens) {
  let modelKey = "gemini-1.5-flash";
  if (model.includes("3.8-flash")) modelKey = "gemini-3.8-flash";
  else if (model.includes("pro")) modelKey = "gemini-1.5-pro";
  const rates = AI_COSTS[modelKey];
  if (!rates) return 0;
  return inputTokens * rates.input + outputTokens * rates.output;
}

// src/services/websiteService.ts
var WebsiteService = class {
  static {
    this.MAX_PAGES = 5;
  }
  static isSafeUrl(urlStr) {
    try {
      const url = new URL(urlStr);
      if (url.protocol !== "http:" && url.protocol !== "https:") return false;
      const hostname = url.hostname.toLowerCase();
      const blocked = [
        "localhost",
        "127.0.0.1",
        "0.0.0.0",
        "::1",
        "metadata.google.internal",
        "169.254.169.254"
      ];
      if (blocked.includes(hostname)) return false;
      const privateIpRegex = /^(10\.|172\.(1[6-9]|2[0-9]|3[0-1])\.|192\.168\.)/;
      if (privateIpRegex.test(hostname)) return false;
      return true;
    } catch {
      return false;
    }
  }
  static async validateWebsite(leadId, url) {
    const startTime = Date.now();
    try {
      if (!this.isSafeUrl(url)) {
        await metrics.record("AUDIT", "WEBSITE_VALIDATION", "FAILURE", Date.now() - startTime, { leadId, url, error: "Unsafe URL" });
        return { reachable: false, error: "Unsafe URL" };
      }
      let response;
      try {
        response = await axios.get(url, {
          timeout: 1e4,
          headers: { "User-Agent": "LeadForge-Audit-Bot/1.0" },
          maxRedirects: 5,
          validateStatus: () => true
        });
      } catch (err) {
        if (err.code?.includes("CERT") || err.message?.includes("certificate") || err.message?.includes("altnames")) {
          response = await axios.get(url, {
            timeout: 1e4,
            headers: { "User-Agent": "LeadForge-Audit-Bot/1.0" },
            httpsAgent: new https.Agent({ rejectUnauthorized: false }),
            maxRedirects: 5,
            validateStatus: () => true
          });
        } else {
          throw err;
        }
      }
      const isReachable = response.status >= 200 && response.status < 500;
      await db.update(leads).set({
        websiteStatus: isReachable ? "verified" : "unreachable",
        websiteLastChecked: /* @__PURE__ */ new Date(),
        websiteExists: isReachable
      }).where(eq2(leads.id, leadId));
      await metrics.record("AUDIT", "WEBSITE_VALIDATION", "SUCCESS", Date.now() - startTime, { leadId, url, status: response.status });
      return { reachable: isReachable, status: response.status };
    } catch (error) {
      const isTimeout = error.code === "ECONNABORTED";
      await metrics.record("AUDIT", "WEBSITE_VALIDATION", isTimeout ? "TIMEOUT" : "FAILURE", Date.now() - startTime, { leadId, url, error: error.message });
      await db.update(leads).set({
        websiteStatus: "unreachable",
        websiteLastChecked: /* @__PURE__ */ new Date(),
        websiteExists: false
      }).where(eq2(leads.id, leadId));
      return { reachable: false, error: error.message };
    }
  }
  static async discoverWebsite(leadId, companyName, city) {
    await db.update(leads).set({
      websiteStatus: "not_detected",
      websiteLastChecked: /* @__PURE__ */ new Date()
    }).where(eq2(leads.id, leadId));
    return { status: "not_detected" };
  }
  static async performAudit(leadId, targetUrl) {
    const startTime = Date.now();
    if (!this.isSafeUrl(targetUrl)) {
      await logger.warn("AUDIT", "Blocked attempt to audit unsafe URL", { leadId, targetUrl }, "WEBSITE_SCRAPER");
      throw new Error("Unsafe URL provided");
    }
    const [auditRecord] = await db.insert(audits).values({
      leadId,
      targetUrl,
      status: "running",
      metrics: {}
    }).returning();
    const auditId = auditRecord.id;
    const findings = [];
    const auditMetrics = {};
    const permissiveAgent = new https.Agent({ rejectUnauthorized: false });
    try {
      let currentUrl = targetUrl;
      let redirects = 0;
      let finalResponse = null;
      let sslIssueDetected = false;
      let sslIssueDetails = "";
      while (redirects < 5) {
        if (!this.isSafeUrl(currentUrl)) {
          await logger.warn("AUDIT", "Blocked redirect to unsafe URL", { auditId, currentUrl }, "WEBSITE_SCRAPER");
          throw new Error("Redirected to unsafe URL");
        }
        try {
          const response = await axios.get(currentUrl, {
            timeout: 12e3,
            headers: {
              "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LeadForge-Audit-Bot/2.0",
              "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
              "Accept-Language": "en-US,en;q=0.9",
              "Cache-Control": "no-cache"
            },
            maxRedirects: 0,
            validateStatus: () => true
            // Allow all status codes (200, 301, 401, 403, 500)
          });
          if (response.status >= 300 && response.status < 400 && response.headers.location) {
            const nextUrl = new URL(response.headers.location, currentUrl).toString();
            currentUrl = nextUrl;
            redirects++;
            continue;
          }
          finalResponse = response;
          break;
        } catch (err) {
          const isSslCertError = err.code?.includes("CERT") || err.message?.includes("certificate") || err.message?.includes("altnames");
          if (isSslCertError && !sslIssueDetected) {
            sslIssueDetected = true;
            sslIssueDetails = err.message;
            try {
              const fallbackResponse = await axios.get(currentUrl, {
                timeout: 12e3,
                headers: {
                  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 LeadForge-Audit-Bot/2.0",
                  "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
                },
                httpsAgent: permissiveAgent,
                maxRedirects: 0,
                validateStatus: () => true
              });
              if (fallbackResponse.status >= 300 && fallbackResponse.status < 400 && fallbackResponse.headers.location) {
                const nextUrl = new URL(fallbackResponse.headers.location, currentUrl).toString();
                currentUrl = nextUrl;
                redirects++;
                continue;
              }
              finalResponse = fallbackResponse;
              break;
            } catch (fallbackErr) {
              throw fallbackErr;
            }
          } else {
            throw err;
          }
        }
      }
      if (!finalResponse) throw new Error("Too many redirects or no response");
      const loadEndTime = Date.now();
      const duration = loadEndTime - startTime;
      const html = typeof finalResponse.data === "string" ? finalResponse.data : "";
      const $ = cheerio.load(html || "<html><body></body></html>");
      auditMetrics.status = finalResponse.status;
      auditMetrics.ttfb = duration;
      auditMetrics.contentSize = html.length;
      auditMetrics.finalUrl = currentUrl;
      auditMetrics.targetUrl = targetUrl;
      auditMetrics.headers = finalResponse.headers || {};
      if (sslIssueDetected) {
        findings.push({
          category: "Security",
          severity: "CRITICAL",
          title: "SSL Certificate Mismatch or Invalidation",
          description: "The website has an invalid or mismatched SSL/TLS certificate. Modern browsers display a warning screen blocking visitors.",
          evidence: sslIssueDetails || "Certificate altnames mismatch or validation failure.",
          recommendation: "Configure a valid TLS/SSL certificate matching this domain name.",
          confidence: "HIGH"
        });
      }
      if (finalResponse.status === 401) {
        findings.push({
          category: "Technical",
          severity: "HIGH",
          title: "Website Requires Authentication (HTTP 401)",
          description: "The website is password protected or requires HTTP Basic Auth. Public customers cannot access the storefront without credentials.",
          evidence: `HTTP 401 returned from ${currentUrl}`,
          recommendation: "Remove authentication restriction or launch the public-facing storefront.",
          confidence: "HIGH"
        });
      } else if (finalResponse.status === 403) {
        findings.push({
          category: "Technical",
          severity: "MEDIUM",
          title: "Access Restricted by Server (HTTP 403)",
          description: "The website web server or firewall blocked automated crawler requests.",
          evidence: `HTTP 403 Forbidden returned from ${currentUrl}`,
          recommendation: "Review web server permissions and ensure legitimate visitors and crawlers are permitted.",
          confidence: "HIGH"
        });
      } else if (finalResponse.status >= 500) {
        findings.push({
          category: "Technical",
          severity: "CRITICAL",
          title: `Web Server Internal Error (HTTP ${finalResponse.status})`,
          description: "The web server encountered a fatal internal error when loading the page.",
          evidence: `HTTP ${finalResponse.status} returned from ${currentUrl}`,
          recommendation: "Resolve server script errors or migrate to high-reliability hosting.",
          confidence: "HIGH"
        });
      }
      let techScore = this.auditTechnical($, finalResponse, findings, auditMetrics);
      if (sslIssueDetected) {
        techScore = Math.max(0, techScore - 40);
      }
      if (finalResponse.status >= 400) {
        techScore = Math.max(0, techScore - 40);
      }
      const seoScore = this.auditSEO($, findings, auditMetrics);
      const convScore = this.auditConversion($, html, findings, auditMetrics);
      const localSeoScore = this.auditLocalSEO($, findings, auditMetrics);
      const scores = {
        technical: techScore,
        seo: seoScore,
        conversion: convScore,
        localSeo: localSeoScore,
        mobile: null,
        performance: this.calculatePerformanceScore(duration, html.length)
      };
      const weights = {
        technical: 0.2,
        seo: 0.2,
        mobile: 0.15,
        performance: 0.15,
        conversion: 0.2,
        localSeo: 0.1
      };
      let overallScore = 0;
      let totalWeight = 0;
      Object.entries(scores).forEach(([key, val]) => {
        if (val !== null) {
          const weight = weights[key];
          overallScore += val * weight;
          totalWeight += weight;
        }
      });
      const finalOverall = totalWeight > 0 ? Math.round(overallScore / totalWeight) : null;
      if (findings.length > 0) {
        await db.insert(auditFindings).values(findings.map((f) => ({
          auditId,
          ...f
        })));
      }
      await db.update(audits).set({
        status: "completed",
        finalUrl: auditMetrics.finalUrl,
        overallScore: finalOverall,
        technicalScore: techScore,
        seoScore,
        conversionScore: convScore,
        localSeoScore,
        mobileScore: null,
        performanceScore: scores.performance,
        metrics: auditMetrics,
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq2(audits.id, auditId));
      await metrics.record("AUDIT", "WEBSITE", "SUCCESS", Date.now() - startTime, { leadId, auditId, score: finalOverall });
      return { auditId, overallScore: finalOverall };
    } catch (error) {
      const isTimeout = error.code === "ECONNABORTED" || error.message?.includes("timeout");
      const isNetworkIssue = error.code === "ENOTFOUND" || error.code === "ECONNREFUSED" || error.code === "EHOSTUNREACH";
      if (isTimeout || isNetworkIssue) {
        if (isTimeout) {
          findings.push({
            category: "Performance",
            severity: "CRITICAL",
            title: "Server Response Timeout (>12s)",
            description: "The website web server failed to respond within 12 seconds. Severe latency or unresponsiveness destroys customer acquisition.",
            evidence: error.message || "Request timed out after 12000ms",
            recommendation: "Upgrade to high-performance managed hosting with SSD storage and edge CDN caching.",
            confidence: "HIGH"
          });
        } else {
          findings.push({
            category: "Technical",
            severity: "CRITICAL",
            title: "Domain DNS or Server Connection Failure",
            description: "The domain name could not be resolved or the web server refused the connection.",
            evidence: error.message,
            recommendation: "Check domain DNS records and ensure web hosting server is active.",
            confidence: "HIGH"
          });
        }
        if (findings.length > 0) {
          await db.insert(auditFindings).values(findings.map((f) => ({
            auditId,
            ...f
          })));
        }
        const fallbackScores = {
          status: "completed",
          finalUrl: targetUrl,
          overallScore: 20,
          technicalScore: isTimeout ? 40 : 15,
          seoScore: null,
          conversionScore: null,
          localSeoScore: null,
          mobileScore: null,
          performanceScore: isTimeout ? 10 : 0,
          metrics: { status: isTimeout ? 504 : 503, error: error.message, ttfb: isTimeout ? 12e3 : 0 },
          completedAt: /* @__PURE__ */ new Date()
        };
        await db.update(audits).set(fallbackScores).where(eq2(audits.id, auditId));
        await metrics.record("AUDIT", "WEBSITE", isTimeout ? "TIMEOUT" : "FAILURE", Date.now() - startTime, { leadId, auditId, error: error.message });
        return { auditId, overallScore: fallbackScores.overallScore };
      }
      await metrics.record("AUDIT", "WEBSITE", "FAILURE", Date.now() - startTime, { leadId, auditId, error: error.message });
      await logger.error("AUDIT", `Audit failed for ${targetUrl}`, error, { leadId, auditId }, "WEBSITE_SCRAPER");
      await db.update(audits).set({
        status: "failed",
        error: error.message,
        completedAt: /* @__PURE__ */ new Date()
      }).where(eq2(audits.id, auditId));
      throw error;
    }
  }
  static auditTechnical($, response, findings, metrics2) {
    let score = 100;
    const url = metrics2.finalUrl || metrics2.targetUrl || "";
    if (url && !url.startsWith("https:")) {
      score -= 30;
      findings.push({
        category: "Technical",
        severity: "HIGH",
        title: "HTTPS not enabled",
        description: "The website does not use a secure HTTPS connection.",
        evidence: `URL protocol is ${url.split(":")[0]}`,
        recommendation: "Install an SSL certificate and redirect all HTTP traffic to HTTPS.",
        confidence: "HIGH"
      });
    }
    const securityHeaders = ["content-security-policy", "strict-transport-security", "x-content-type-options"];
    securityHeaders.forEach((h) => {
      if (!response.headers[h]) {
        score -= 5;
        findings.push({
          category: "Technical",
          severity: "LOW",
          title: `Missing security header: ${h}`,
          description: `The ${h} header was not detected.`,
          evidence: "Header not found in response.",
          recommendation: `Implement the ${h} header to improve website security.`,
          confidence: "HIGH"
        });
      }
    });
    return Math.max(0, score);
  }
  static auditSEO($, findings, metrics2) {
    let score = 100;
    const title = $("title").text().trim();
    if (!title) {
      score -= 30;
      findings.push({
        category: "SEO",
        severity: "HIGH",
        title: "Missing SEO Title",
        description: "No <title> tag was found on the homepage.",
        evidence: "title element is empty or missing.",
        recommendation: "Add a unique, descriptive title between 50-60 characters.",
        confidence: "HIGH"
      });
    }
    const description = $('meta[name="description"]').attr("content");
    if (!description) {
      score -= 20;
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "Missing Meta Description",
        description: "The meta description tag is missing.",
        evidence: 'meta[name="description"] not found.',
        recommendation: "Add a meta description that summarizes the page content (150-160 characters).",
        confidence: "HIGH"
      });
    }
    const h1s = $("h1");
    if (h1s.length === 0) {
      score -= 20;
      findings.push({
        category: "SEO",
        severity: "MEDIUM",
        title: "No H1 Heading",
        description: "The page lacks a main H1 heading.",
        evidence: "0 H1 elements detected.",
        recommendation: "Add one primary H1 heading containing your main keyword.",
        confidence: "HIGH"
      });
    } else if (h1s.length > 1) {
      score -= 5;
      findings.push({
        category: "SEO",
        severity: "LOW",
        title: "Multiple H1 Headings",
        description: "Detected multiple H1 tags on the same page.",
        evidence: `${h1s.length} H1 elements found.`,
        recommendation: "Use only one H1 per page for better structural clarity.",
        confidence: "HIGH"
      });
    }
    return Math.max(0, score);
  }
  static auditConversion($, html, findings, metrics2) {
    let score = 0;
    const checks = [
      { id: "phone", label: "Phone CTA", weight: 20, pattern: /tel:|(?:\+?(\d{1,3}))?[-. (]*(\d{3})[-. )]*(\d{3})[-. ]*(\d{4})(?: *x(\d+))?/ },
      { id: "email", label: "Email CTA", weight: 20, pattern: /mailto:/ },
      { id: "form", label: "Contact Form", weight: 20, element: "form" },
      { id: "whatsapp", label: "WhatsApp", weight: 20, pattern: /wa\.me|whatsapp\.com\/send/ },
      { id: "booking", label: "Booking System", weight: 20, pattern: /book|appointment|calendly|doctolib/i }
    ];
    checks.forEach((check) => {
      let detected = false;
      if (check.pattern && check.pattern.test(html)) detected = true;
      if (check.element && $(check.element).length > 0) detected = true;
      if (detected) {
        score += check.weight;
      } else {
        findings.push({
          category: "Conversion",
          severity: "MEDIUM",
          title: `${check.label} not detected`,
          description: `No obvious ${check.label.toLowerCase()} found on the audited page.`,
          evidence: `Pattern/Element '${check.id}' not found.`,
          recommendation: `Add a visible ${check.label} to improve conversion rates.`,
          confidence: "MEDIUM"
        });
      }
    });
    return score;
  }
  static auditLocalSEO($, findings, metrics2) {
    let score = 0;
    const jsonLd = $('script[type="application/ld+json"]');
    let hasLocalSchema = false;
    jsonLd.each((i, el) => {
      try {
        const data = JSON.parse($(el).html());
        const types = Array.isArray(data["@type"]) ? data["@type"] : [data["@type"]];
        if (types.some((t) => t && (t.includes("LocalBusiness") || t.includes("Organization")))) hasLocalSchema = true;
      } catch {
      }
    });
    if (hasLocalSchema) {
      score += 50;
    } else {
      findings.push({
        category: "Local SEO",
        severity: "MEDIUM",
        title: "LocalBusiness Schema Missing",
        description: "Structured data for local business was not detected.",
        evidence: "No JSON-LD with type LocalBusiness found.",
        recommendation: "Add LocalBusiness structured data to help search engines understand your location and services.",
        confidence: "HIGH"
      });
    }
    const addressKeywords = ["street", "road", "avenue", "address", "city", "zip", "postal"];
    const bodyText = $("body").text().toLowerCase();
    const hasAddress = addressKeywords.some((k) => bodyText.includes(k)) && /\d+/.test(bodyText);
    if (hasAddress) {
      score += 50;
    } else {
      findings.push({
        category: "Local SEO",
        severity: "MEDIUM",
        title: "Address not detected",
        description: "Physical address information was not clearly found.",
        evidence: "Text analysis failed to find clear address patterns.",
        recommendation: "Display your business address clearly in the footer or contact page.",
        confidence: "LOW"
      });
    }
    return score;
  }
  static calculatePerformanceScore(duration, size) {
    let score = 100;
    if (duration > 5e3) score -= 40;
    else if (duration > 2e3) score -= 20;
    else if (duration > 1e3) score -= 5;
    if (size > 1e6) score -= 30;
    else if (size > 5e5) score -= 15;
    return Math.max(0, score);
  }
};

// src/services/jobService.ts
init_db();
init_schema();
import { eq as eq5 } from "drizzle-orm";

// src/services/sources/csvSource.ts
var CSVSource = class {
  async search(criteria) {
    const { rows, mapping } = criteria;
    return rows.map((row, index2) => {
      const rawLead = {
        source: "csv_import",
        sourceId: `csv-${Date.now()}-${index2}`,
        companyName: row[mapping.companyName] || "UNKNOWN",
        category: row[mapping.category],
        country: row[mapping.country],
        region: row[mapping.region],
        city: row[mapping.city],
        address: row[mapping.address],
        phone: row[mapping.phone],
        email: row[mapping.email],
        website: row[mapping.website],
        latitude: row[mapping.latitude] ? parseFloat(row[mapping.latitude]) : void 0,
        longitude: row[mapping.longitude] ? parseFloat(row[mapping.longitude]) : void 0,
        rawData: row
      };
      return rawLead;
    });
  }
  async validateConfiguration() {
    return { valid: true };
  }
  getSourceName() {
    return "CSV Import";
  }
  getCapabilities() {
    return ["company_name", "phone", "email", "website", "address", "category", "location"];
  }
};

// src/services/sources/osmSource.ts
import axios3 from "axios";

// src/services/sources/osmCategoryMapper.ts
var OSMCategoryMapper = class {
  static {
    this.mapping = {
      "phone repair": {
        tags: [
          { key: "shop", value: "mobile_phone" },
          { key: "shop", value: "electronics" },
          { key: "shop", value: "telecommunication" },
          { key: "craft", value: "electronics_repair" },
          { key: "repair", value: "mobile_phone" },
          { key: "repair", value: "phone" },
          { key: "repair", value: "electronics" },
          { key: "amenity", value: "mobile_phone_repair" }
        ]
      },
      "electronics repair": {
        tags: [
          { key: "craft", value: "electronics_repair" },
          { key: "shop", value: "electronics" },
          { key: "repair", value: "electronics" },
          { key: "repair", value: "computer" }
        ]
      },
      "restaurant": {
        tags: [
          { key: "amenity", value: "restaurant" },
          { key: "amenity", value: "bistro" },
          { key: "amenity", value: "fast_food" }
        ]
      },
      "car rental": {
        tags: [
          { key: "amenity", value: "car_rental" }
        ]
      },
      "plumber": {
        tags: [
          { key: "craft", value: "plumber" },
          { key: "craft", value: "sanitary" },
          { key: "office", value: "plumbing" }
        ]
      },
      "heating company": {
        tags: [
          { key: "craft", value: "hvac" },
          { key: "craft", value: "heating" }
        ]
      },
      "architect": {
        tags: [
          { key: "office", value: "architect" },
          { key: "office", value: "architectural_design" }
        ]
      },
      "dentist": {
        tags: [
          { key: "amenity", value: "dentist" },
          { key: "healthcare", value: "dentist" },
          { key: "amenity", value: "dental_clinic" }
        ]
      },
      "barber": {
        tags: [
          { key: "shop", value: "hairdresser" },
          { key: "shop", value: "barber" }
        ]
      },
      "hairdresser": {
        tags: [
          { key: "shop", value: "hairdresser" },
          { key: "shop", value: "barber" },
          { key: "shop", value: "beauty" }
        ]
      },
      "law firm": {
        tags: [
          { key: "office", value: "lawyer" },
          { key: "office", value: "legal" }
        ]
      },
      "real estate agency": {
        tags: [
          { key: "office", value: "estate_agent" },
          { key: "office", value: "property_management" }
        ]
      },
      "car mechanic": {
        tags: [
          { key: "shop", value: "car_repair" },
          { key: "amenity", value: "car_repair" },
          { key: "craft", value: "car_repair" },
          { key: "shop", value: "tyres" },
          { key: "shop", value: "car" },
          { key: "shop", value: "car_parts" },
          { key: "shop", value: "motorcycle_repair" },
          { key: "craft", value: "mechanic" }
        ]
      },
      "auto repair": {
        tags: [
          { key: "shop", value: "car_repair" },
          { key: "amenity", value: "car_repair" },
          { key: "craft", value: "car_repair" },
          { key: "shop", value: "tyres" },
          { key: "shop", value: "car" },
          { key: "shop", value: "car_parts" },
          { key: "shop", value: "motorcycle_repair" },
          { key: "craft", value: "mechanic" }
        ]
      },
      "bakery": {
        tags: [
          { key: "shop", value: "bakery" },
          { key: "shop", value: "pastry" }
        ]
      },
      "cafe": {
        tags: [
          { key: "amenity", value: "cafe" },
          { key: "amenity", value: "coffee_shop" }
        ]
      },
      "pharmacy": {
        tags: [
          { key: "amenity", value: "pharmacy" },
          { key: "healthcare", value: "pharmacy" },
          { key: "shop", value: "chemist" }
        ]
      },
      "hotel": {
        tags: [
          { key: "tourism", value: "hotel" },
          { key: "tourism", value: "guest_house" },
          { key: "tourism", value: "motel" }
        ]
      },
      "gym": {
        tags: [
          { key: "leisure", value: "fitness_centre" },
          { key: "leisure", value: "sports_centre" }
        ]
      },
      "spa": {
        tags: [
          { key: "leisure", value: "spa" },
          { key: "shop", value: "beauty" }
        ]
      },
      "cleaning service": {
        tags: [
          { key: "office", value: "cleaning" },
          { key: "craft", value: "cleaning" }
        ]
      },
      "electrician": {
        tags: [
          { key: "craft", value: "electrician" },
          { key: "office", value: "electrical" }
        ]
      },
      "painter": {
        tags: [
          { key: "craft", value: "painter" }
        ]
      },
      "veterinarian": {
        tags: [
          { key: "amenity", value: "veterinary" },
          { key: "healthcare", value: "veterinary" }
        ]
      },
      "it services": {
        tags: [
          { key: "office", value: "it" },
          { key: "office", value: "software" },
          { key: "shop", value: "computer" }
        ]
      },
      "roofing": {
        tags: [
          { key: "craft", value: "roofer" }
        ]
      },
      "landscaping": {
        tags: [
          { key: "craft", value: "gardener" }
        ]
      },
      "boutique": {
        tags: [
          { key: "shop", value: "boutique" },
          { key: "shop", value: "clothes" },
          { key: "shop", value: "fashion" }
        ]
      },
      "beauty salon": {
        tags: [
          { key: "shop", value: "beauty" },
          { key: "shop", value: "cosmetics" }
        ]
      },
      "lawyer": {
        tags: [
          { key: "office", value: "lawyer" },
          { key: "office", value: "legal" },
          { key: "amenity", value: "lawyer" }
        ]
      },
      "carpenter": {
        tags: [
          { key: "craft", value: "carpenter" },
          { key: "craft", value: "joiner" }
        ]
      },
      "florist": {
        tags: [
          { key: "shop", value: "florist" }
        ]
      },
      "optician": {
        tags: [
          { key: "shop", value: "optician" },
          { key: "healthcare", value: "optometrist" }
        ]
      },
      "accountant": {
        tags: [
          { key: "office", value: "accountant" },
          { key: "office", value: "tax_advisor" }
        ]
      },
      "locksmith": {
        tags: [
          { key: "craft", value: "locksmith" },
          { key: "shop", value: "locksmith" }
        ]
      },
      "dry cleaning": {
        tags: [
          { key: "shop", value: "dry_cleaning" },
          { key: "shop", value: "laundry" }
        ]
      },
      "butcher": {
        tags: [
          { key: "shop", value: "butcher" }
        ]
      },
      "grocery": {
        tags: [
          { key: "shop", value: "supermarket" },
          { key: "shop", value: "convenience" },
          { key: "shop", value: "greengrocer" }
        ]
      },
      "doctor": {
        tags: [
          { key: "amenity", value: "doctors" },
          { key: "healthcare", value: "doctor" },
          { key: "amenity", value: "clinic" }
        ]
      }
    };
  }
  static normalize(str) {
    return str.toLowerCase().trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }
  static getMapping(category) {
    const raw = category.toLowerCase().trim();
    const normalized = this.normalize(category);
    if (this.mapping[raw]) return this.mapping[raw];
    if (this.mapping[normalized]) return this.mapping[normalized];
    if (normalized.includes("mecanic") || normalized.includes("garag") || normalized.includes("auto") || normalized.includes("carrosser") || normalized.includes("pneu") || normalized.includes("vidange") || normalized.includes("controle tech") || normalized.includes("depannage auto")) {
      return this.mapping["car mechanic"];
    }
    if (normalized.includes("plomb") || normalized.includes("chauffag") || normalized.includes("sanitair")) {
      return this.mapping["plumber"];
    }
    if (normalized.includes("avocat") || normalized.includes("notair") || normalized.includes("juridiq") || normalized.includes("lawyer") || normalized.includes("legal")) {
      return this.mapping["lawyer"];
    }
    if (normalized.includes("dentist") || normalized.includes("dentair") || normalized.includes("orthodont")) {
      return this.mapping["dentist"];
    }
    if (normalized.includes("medecin") || normalized.includes("docteur") || normalized.includes("medical") || normalized.includes("cliniq") || normalized.includes("doctor")) {
      return this.mapping["doctor"];
    }
    if (normalized.includes("coiff") || normalized.includes("barbi") || normalized.includes("barber") || normalized.includes("hair")) {
      return this.mapping["hairdresser"];
    }
    if (normalized.includes("boulang") || normalized.includes("patiss") || normalized.includes("baker") || normalized.includes("pastry")) {
      return this.mapping["bakery"];
    }
    if (normalized.includes("restau") || normalized.includes("brasser") || normalized.includes("pizz") || normalized.includes("bistro") || normalized.includes("creper") || normalized.includes("traiteur")) {
      return this.mapping["restaurant"];
    }
    if (normalized.includes("pharmac") || normalized.includes("parapharmac") || normalized.includes("chemist")) {
      return this.mapping["pharmacy"];
    }
    if (normalized.includes("electri")) {
      return this.mapping["electrician"];
    }
    if (normalized.includes("immobili") || normalized.includes("real estate") || normalized.includes("agence immo")) {
      return this.mapping["real estate agency"];
    }
    if (normalized.includes("architect")) {
      return this.mapping["architect"];
    }
    if (normalized.includes("menuis") || normalized.includes("charpent") || normalized.includes("carpent")) {
      return this.mapping["carpenter"];
    }
    if (normalized.includes("peint") || normalized.includes("paint")) {
      return this.mapping["painter"];
    }
    if (normalized.includes("informatiq") || normalized.includes("ordinateur") || normalized.includes("logiciel") || normalized.includes("software") || normalized.includes("web")) {
      return this.mapping["it services"];
    }
    if (normalized.includes("telephon") || normalized.includes("phone") || normalized.includes("smartphone") || normalized.includes("mobile") || normalized.includes("reparation")) {
      return this.mapping["phone repair"];
    }
    if (normalized.includes("veterin")) {
      return this.mapping["veterinarian"];
    }
    if (normalized.includes("fleur") || normalized.includes("florist")) {
      return this.mapping["florist"];
    }
    if (normalized.includes("optic") || normalized.includes("lunett")) {
      return this.mapping["optician"];
    }
    if (normalized.includes("comptab") || normalized.includes("account")) {
      return this.mapping["accountant"];
    }
    if (normalized.includes("serrur") || normalized.includes("locksmith")) {
      return this.mapping["locksmith"];
    }
    if (normalized.includes("press") || normalized.includes("blanchiss") || normalized.includes("laver") || normalized.includes("laundry")) {
      return this.mapping["dry cleaning"];
    }
    if (normalized.includes("hotel") || normalized.includes("heberg") || normalized.includes("gite") || normalized.includes("auberge")) {
      return this.mapping["hotel"];
    }
    if (normalized.includes("sport") || normalized.includes("fitness") || normalized.includes("muscu") || normalized.includes("gym")) {
      return this.mapping["gym"];
    }
    if (normalized.includes("beaut") || normalized.includes("esthetiq") || normalized.includes("ongl") || normalized.includes("spa")) {
      return this.mapping["beauty salon"];
    }
    if (normalized.includes("bouch") || normalized.includes("charcut") || normalized.includes("butcher")) {
      return this.mapping["butcher"];
    }
    if (normalized.includes("epic") || normalized.includes("superm") || normalized.includes("aliment") || normalized.includes("grocer")) {
      return this.mapping["grocery"];
    }
    if (normalized.includes("nettoy") || normalized.includes("clean")) {
      return this.mapping["cleaning service"];
    }
    for (const [key, value] of Object.entries(this.mapping)) {
      if (normalized.includes(key) || key.includes(normalized)) {
        return value;
      }
    }
    const cleanWord = normalized.replace(/[^a-z0-9]/g, "_");
    return {
      tags: [
        { key: "shop", value: cleanWord },
        { key: "amenity", value: cleanWord },
        { key: "office", value: cleanWord },
        { key: "craft", value: cleanWord }
      ]
    };
  }
  static getQueryParts(category) {
    const mapping = this.getMapping(category);
    const parts = [];
    for (const tag of mapping.tags) {
      if (tag.value === "*") {
        parts.push(`node["${tag.key}"][name];`);
        parts.push(`way["${tag.key}"][name];`);
      } else {
        parts.push(`node["${tag.key}"="${tag.value}"][name];`);
        parts.push(`way["${tag.key}"="${tag.value}"][name];`);
      }
    }
    return parts;
  }
  static getNWRQueryParts(category) {
    const mapping = this.getMapping(category);
    const parts = [];
    for (const tag of mapping.tags) {
      if (tag.value === "*") {
        parts.push(`nwr["${tag.key}"][name];`);
      } else {
        parts.push(`nwr["${tag.key}"="${tag.value}"][name];`);
      }
    }
    return parts;
  }
};

// src/services/sources/chainFilter.ts
var ChainFilter = class {
  static {
    // Common corporate brands, retail chains, fast-food franchises, and multinational conglomerates
    this.KNOWN_CHAINS = [
      // Electronics, Books & Multimedia
      "fnac",
      "darty",
      "boulanger",
      "apple store",
      "apple",
      "mediamarkt",
      "best buy",
      "micromania",
      "nature & decouvertes",
      "nature et decouvertes",
      "cultura",
      "ldlc",
      // Supermarkets & Hypermarkets & Convenience Stores
      "carrefour",
      "carrefour market",
      "carrefour city",
      "carrefour express",
      "carrefour contact",
      "monoprix",
      "monop",
      "monop'",
      "auchan",
      "leclerc",
      "e.leclerc",
      "intermarche",
      "intermarch\xE9",
      "casino",
      "super u",
      "hyper u",
      "u express",
      "franprix",
      "lidl",
      "aldi",
      "cora",
      "match",
      "walmart",
      "target",
      "tesco",
      "sainsbury",
      "marks & spencer",
      "costco",
      "migros",
      "coop",
      "denner",
      "spar",
      "spar express",
      "seven eleven",
      "7-eleven",
      "carrefour bio",
      // Fast Food, Coffee & Casual Dining Chains
      "mcdonald",
      "mcdonald's",
      "mcdo",
      "burger king",
      "kfc",
      "subway",
      "starbucks",
      "domino",
      "domino's",
      "pizza hut",
      "five guys",
      "chipotle",
      "paul",
      "brioche doree",
      "brioche dor\xE9e",
      "columbus cafe",
      "columbus caf\xE9",
      "pret a manger",
      "pr\xEAt \xE0 manger",
      "costa coffee",
      "dunkin",
      "o'tacos",
      "otacos",
      "pitaya",
      "quick",
      "buffalo grill",
      "courtepaille",
      "la boucherie",
      "hippopotamus",
      "flunch",
      "del arte",
      "pizza del arte",
      "vapiano",
      "nando",
      "nando's",
      // Fashion, Footwear & Apparel Chains
      "zara",
      "h&m",
      "h & m",
      "mango",
      "bershka",
      "pull&bear",
      "pull and bear",
      "stradivarius",
      "primark",
      "uniqlo",
      "celio",
      "jules",
      "brice",
      "etam",
      "calzedonia",
      "intimissimi",
      "tezenis",
      "kiabi",
      "gemo",
      "g\xE9mo",
      "la halle",
      "promod",
      "gap",
      "levi's",
      "levis",
      "foot locker",
      "courir",
      "snipes",
      "jd sports",
      "decathlon",
      "intersport",
      "go sport",
      "pimkie",
      "jennyfer",
      "undiz",
      "petit bateau",
      "okaidi",
      "oka\xEFdi",
      "sergent major",
      // Beauty, Cosmetics & Perfumery
      "sephora",
      "marionnaud",
      "yves rocher",
      "nocibe",
      "nocib\xE9",
      "kiko milano",
      "kiko",
      "l'occitane",
      "loccitane",
      "the body shop",
      "lush",
      "mac cosmetics",
      "ritual",
      "rituals",
      // Home, DIY & Furniture
      "ikea",
      "leroy merlin",
      "castorama",
      "brico depot",
      "brico d\xE9p\xF4t",
      "bricorama",
      "mr bricolage",
      "conforama",
      "but",
      "maisons du monde",
      "habitat",
      "alinea",
      "alin\xE9a",
      "saint maclou",
      // Telecom & Tech Operators
      "orange",
      "sfr",
      "bouygues telecom",
      "bouygues",
      "free center",
      "free mobile",
      "vodafone",
      "o2",
      "t-mobile",
      "at&t",
      "verizon",
      "swisscom",
      "sunrise",
      "salt store",
      // Banks & Financial Institutions
      "bnp paribas",
      "societe generale",
      "soci\xE9t\xE9 g\xE9n\xE9rale",
      "credit agricole",
      "cr\xE9dit agricole",
      "lcl",
      "caisse d'epargne",
      "caisse d'\xE9pargne",
      "banque populaire",
      "credit mutuel",
      "cr\xE9dit mutuel",
      "cic",
      "axa",
      "allianz",
      "groupama",
      "macif",
      "maif",
      "matmut",
      "ubs",
      "credit suisse",
      "postfinance",
      "santander",
      "bbva",
      "hsbc",
      "barclays",
      "deutsche bank",
      // Fuel & Automotive Service Chains
      "total",
      "totalenergies",
      "shell",
      "bp",
      "esso",
      "repsol",
      "eni",
      "norauto",
      "feu vert",
      "midas",
      "speedy",
      "point s",
      "carglass",
      "euromaster",
      "avis",
      "hertz",
      "sixt",
      "europcar",
      // Eyewear Chains
      "optical center",
      "alain afflelou",
      "afflelou",
      "krys",
      "grandoptical",
      "atol",
      "generale d'optique",
      "g\xE9n\xE9rale d'optique",
      "optique 2000",
      // Frozen Food & Specialty Chain Retail
      "picard",
      "naturalia",
      "biocoop",
      "bio c' bon",
      "bio c bon",
      "la vie claire",
      // Hotel & Hospitality Chains
      "ibis",
      "ibis budget",
      "ibis styles",
      "novotel",
      "mercure",
      "sofitel",
      "marriott",
      "hilton",
      "best western",
      "b&b hotels",
      "premiere classe",
      "premi\xE8re classe",
      "campanile",
      "kyriad",
      "f1 hotel",
      "hotel f1",
      "radisson",
      "sheraton",
      "holiday inn"
    ];
  }
  /**
   * Evaluates whether an OSM entity or raw lead represents a major corporate chain or famous multinational place.
   */
  static isChainOrMajorBrand(tags, name) {
    if (!tags) tags = {};
    if (tags.brand || tags["brand:wikidata"] || tags["brand:wikipedia"]) {
      return true;
    }
    if (tags.chain === "yes" || tags.franchise === "yes") {
      return true;
    }
    if (tags.network && typeof tags.network === "string" && tags.network.length > 2) {
      return true;
    }
    if (tags.operator && typeof tags.operator === "string") {
      const op = tags.operator.toLowerCase();
      for (const chain of this.KNOWN_CHAINS) {
        if (op.includes(chain)) return true;
      }
    }
    const businessName = (name || tags.name || "").toLowerCase().trim();
    if (!businessName) return false;
    const cleanBusinessName = businessName.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "");
    for (const chain of this.KNOWN_CHAINS) {
      const cleanChain = chain.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/['’]/g, "");
      const regex = new RegExp(`(^|\\s|[^a-z0-9])${cleanChain}($|\\s|[^a-z0-9])`, "i");
      if (regex.test(cleanBusinessName) || cleanBusinessName.startsWith(cleanChain + " ") || cleanBusinessName === cleanChain) {
        return true;
      }
    }
    if (tags.amenity === "police" || tags.amenity === "fire_station" || tags.amenity === "embassy" || tags.amenity === "courthouse" || tags.amenity === "townhall" || tags.public_transport) {
      return true;
    }
    return false;
  }
};

// src/services/leadService.ts
init_db();
init_schema();
import { eq as eq3, and } from "drizzle-orm";
var NormalizationService = class {
  static normalizeCompanyName(name) {
    return name.trim().replace(/\s+/g, " ").toUpperCase();
  }
  static normalizeDomain(url) {
    try {
      if (!url) return null;
      let clean = url.trim().toLowerCase();
      if (!clean.startsWith("http://") && !clean.startsWith("https://")) {
        clean = "http://" + clean;
      }
      const urlObj = new URL(clean);
      let hostname = urlObj.hostname;
      if (hostname.startsWith("www.")) {
        hostname = hostname.substring(4);
      }
      return hostname;
    } catch {
      return null;
    }
  }
  static normalizePhone(phone) {
    if (!phone) return "";
    const cleaned = phone.replace(/[^\d+]/g, "");
    return cleaned;
  }
  static normalizeEmail(email) {
    if (!email) return "";
    return email.trim().toLowerCase();
  }
};
var ValidationService = class {
  static validateEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(email)) return false;
    const lower = email.toLowerCase();
    if (lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".webp") || lower.endsWith(".svg")) return false;
    if (lower.includes("sentry") || lower.includes("wixpress") || lower.includes("example.com")) return false;
    return true;
  }
  static validatePhone(phone) {
    const clean = phone.replace(/[^\d]/g, "");
    return clean.length >= 7 && clean.length <= 15;
  }
  static isInvalidBusinessName(name) {
    if (!name) return true;
    const trimmed = name.trim();
    if (trimmed.length < 2) return true;
    if (!/[a-zA-Z\u00C0-\u024F]/.test(trimmed)) return true;
    const lower = trimmed.toLowerCase();
    const genericBlocked = [
      "unnamed",
      "unknown",
      "n/a",
      "sans nom",
      "point of interest",
      "parking",
      "abri bus",
      "bus stop",
      "toilettes",
      "toilet",
      "wc",
      "poste",
      "boite aux lettres",
      "post box",
      "distributeur",
      "atm",
      "substation",
      "borne de recharge",
      "recycling",
      "poubelle",
      "banc",
      "bench",
      "calvaire",
      "statue",
      "monument",
      "fontaine",
      "cimetiere",
      "cemetery",
      "test",
      "chantier",
      "batiment",
      "building",
      "residential",
      "maison",
      "residence",
      "immeuble",
      "arret",
      "gare",
      "station service",
      "station essence",
      "lavoir",
      "eglise"
    ];
    if (genericBlocked.some((b) => lower === b || lower === `le ${b}` || lower === `la ${b}` || lower.startsWith(b + " ") || lower.endsWith(" " + b))) {
      return true;
    }
    if (/^\d+\s+(rue|avenue|boulevard|chemin|allee|route|place|str\.|strasse|gasse|street|road|ave)/i.test(lower)) {
      return true;
    }
    return false;
  }
  static isVerifiedBusiness(data, strictContact = false) {
    if (this.isInvalidBusinessName(data.companyName)) return false;
    const hasPhone = Boolean(data.phone && data.phone.trim().length >= 6);
    const hasWebsite = Boolean(data.website && data.website.trim().length >= 4);
    const hasEmail = Boolean(data.email && this.validateEmail(data.email));
    const hasAddress = Boolean(data.address && data.address.trim().length >= 6);
    if (strictContact) {
      return hasPhone || hasWebsite || hasEmail;
    }
    return hasPhone || hasWebsite || hasEmail || hasAddress;
  }
};
var LeadService = class {
  static async createLead(data, campaignId, options) {
    if (ValidationService.isInvalidBusinessName(data.companyName)) {
      return { lead: null, status: "rejected_unverified" };
    }
    if (options?.requireVerifiedContact && !ValidationService.isVerifiedBusiness(data, true)) {
      return { lead: null, status: "rejected_unverified" };
    }
    const normalizedName = NormalizationService.normalizeCompanyName(data.companyName || "");
    const normalizedDomain = NormalizationService.normalizeDomain(data.website);
    const normalizedPhone = NormalizationService.normalizePhone(data.phone);
    let existingLead = null;
    if (normalizedDomain) {
      existingLead = await db.query.leads.findFirst({
        where: campaignId ? and(eq3(leads.campaignId, campaignId), eq3(leads.normalizedDomain, normalizedDomain)) : eq3(leads.normalizedDomain, normalizedDomain)
      });
    }
    if (!existingLead && normalizedPhone && normalizedPhone.length >= 7) {
      existingLead = await db.query.leads.findFirst({
        where: campaignId ? and(eq3(leads.campaignId, campaignId), eq3(leads.normalizedPhone, normalizedPhone)) : eq3(leads.normalizedPhone, normalizedPhone)
      });
    }
    if (!existingLead && normalizedName && (data.city || data.address)) {
      const conds = [
        eq3(leads.normalizedCompanyName, normalizedName),
        data.city ? eq3(leads.city, data.city) : void 0,
        campaignId ? eq3(leads.campaignId, campaignId) : void 0
      ].filter(Boolean);
      existingLead = await db.query.leads.findFirst({
        where: and(...conds)
      });
    }
    if (existingLead) {
      return { lead: existingLead, status: "duplicate" };
    }
    const hasWebsite = Boolean(data.website);
    const hasPhone = Boolean(data.phone);
    const [newLead] = await db.insert(leads).values({
      campaignId,
      companyName: data.companyName,
      normalizedCompanyName: normalizedName,
      category: data.category,
      country: data.country,
      region: data.region,
      city: data.city,
      address: data.address,
      latitude: data.latitude,
      longitude: data.longitude,
      phone: data.phone,
      normalizedPhone: normalizedPhone || null,
      email: data.email,
      website: data.website,
      normalizedDomain,
      googleRating: data.googleRating,
      googleReviews: data.googleReviews,
      source: data.source || "OpenStreetMap",
      sourceUrl: data.sourceUrl,
      discoverySource: data.source || "OpenStreetMap",
      websiteStatus: hasWebsite ? data.website?.includes("facebook.com") || data.website?.includes("instagram.com") || data.website?.includes("linkedin.com") ? "social_profile" : "verified" : "unknown",
      websiteConfidence: hasWebsite ? "HIGH" : "UNKNOWN",
      dataConfidence: hasWebsite && hasPhone ? "HIGH" : hasWebsite || hasPhone ? "MEDIUM" : "LOW",
      leadStatus: "NEW"
    }).returning();
    const evidenceItems = [];
    const sourceName = data.source === "CSV" ? "CSV_IMPORT" : "OPENSTREETMAP";
    if (data.phone) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: "phone",
        value: data.phone,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: "HIGH"
      });
    }
    if (data.email) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: "email",
        value: data.email,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: "HIGH"
      });
    }
    if (data.address) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: "address",
        value: data.address,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: "HIGH"
      });
    }
    if (data.website) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: "website",
        value: data.website,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: "HIGH"
      });
    }
    if (data.rawData?.openingHours) {
      evidenceItems.push({
        leadId: newLead.id,
        fieldName: "opening_hours",
        value: data.rawData.openingHours,
        source: sourceName,
        sourceUrl: data.sourceUrl || null,
        verified: true,
        confidence: "HIGH"
      });
    }
    if (data.rawData?.socialLinks) {
      Object.entries(data.rawData.socialLinks).forEach(([platform, url]) => {
        if (url && typeof url === "string") {
          evidenceItems.push({
            leadId: newLead.id,
            fieldName: platform,
            value: url,
            source: sourceName,
            sourceUrl: url,
            verified: true,
            confidence: "HIGH"
          });
        }
      });
    }
    if (evidenceItems.length > 0) {
      await db.insert(fieldEvidence).values(evidenceItems);
    }
    return { lead: newLead, status: "created" };
  }
};

// src/services/sources/osmSource.ts
var OSMSource = class {
  constructor() {
    this.overpassUrls = [
      "https://lz4.overpass-api.de/api/interpreter",
      "https://overpass-api.de/api/interpreter",
      "https://overpass.kumi.systems/api/interpreter"
    ];
  }
  async search(criteria) {
    const startTime = Date.now();
    const country = criteria.country ? criteria.country.trim() : void 0;
    const city = criteria.city ? criteria.city.trim() : void 0;
    const category = criteria.category ? criteria.category.trim() : void 0;
    const { limit = 50, bbox } = criteria;
    let activeBbox = bbox;
    if (!activeBbox && (city || country)) {
      try {
        const { GridPartitionService: GridPartitionService2 } = await Promise.resolve().then(() => (init_gridPartitionService(), gridPartitionService_exports));
        const loc = [city, country].filter(Boolean).join(", ");
        const resolved = await GridPartitionService2.getBoundingBox(loc);
        if (resolved) {
          activeBbox = resolved;
        }
      } catch {
      }
    }
    let areaPart = "";
    if (!activeBbox) {
      if (city && country) {
        areaPart = `area["name"="${city}"]->.searchArea;`;
      } else if (city) {
        areaPart = `area["name"="${city}"]->.searchArea;`;
      } else if (country) {
        areaPart = `area["name"="${country}"]->.searchArea;`;
      }
    }
    const bboxDecl = activeBbox ? `[bbox:${activeBbox.minLat},${activeBbox.minLon},${activeBbox.maxLat},${activeBbox.maxLon}]` : "";
    const queryParts = category ? OSMCategoryMapper.getNWRQueryParts(category) : [
      'nwr["amenity"];',
      'nwr["shop"];',
      'nwr["office"];',
      'nwr["craft"];'
    ];
    const finalQueryParts = queryParts.map((part) => {
      if (activeBbox || !areaPart) return part;
      return part.replace(";", "(area.searchArea);");
    });
    const query = `
      [out:json][timeout:25]${bboxDecl};
      ${activeBbox ? "" : areaPart}
      (
        ${finalQueryParts.join("\n        ")}
      );
      out center ${limit};
    `;
    try {
      let response;
      let attemptCount = 0;
      let lastError = null;
      for (const endpoint of this.overpassUrls) {
        attemptCount++;
        try {
          response = await axios3.post(endpoint, "data=" + encodeURIComponent(query), {
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
              "User-Agent": "LeadForge-Discovery/2.0",
              "Referer": "https://leadforge.app/"
            },
            timeout: 18e3
          });
          if (response?.data?.elements) {
            if (attemptCount > 1) {
              await metrics.record("SOURCE", "OSM", "RETRY_SUCCESS", Date.now() - startTime, { criteria, endpoint, attemptCount });
            } else {
              await metrics.record("SOURCE", "OSM", "SUCCESS", Date.now() - startTime, { criteria, endpoint });
            }
            break;
          }
        } catch (err) {
          lastError = err;
          const status = err.response?.status;
          const isTimeout = err.code === "ECONNABORTED" || status === 504 || status === 502;
          await logger.warn("OSM", `Mirror ${endpoint} attempt ${attemptCount} failed (${status || err.code}): ${err.message}`, {
            status,
            code: err.code,
            endpoint,
            criteria,
            isTimeout
          }, "OSM_API");
          await new Promise((resolve) => setTimeout(resolve, 800));
        }
      }
      if (!response?.data && lastError) {
        await metrics.record("SOURCE", "OSM", "FAILURE", Date.now() - startTime, { criteria, attemptCount, error: lastError.message });
      }
      const elements = response?.data?.elements || [];
      const results = [];
      let chainsExcludedCount = 0;
      for (const el of elements) {
        if (!el.tags || !el.tags.name) continue;
        const tags = el.tags;
        if (ValidationService.isInvalidBusinessName(tags.name)) {
          continue;
        }
        if (criteria.localOnly !== false && ChainFilter.isChainOrMajorBrand(tags, tags.name)) {
          chainsExcludedCount++;
          continue;
        }
        const street = tags["addr:street"] || "";
        const houseNr = tags["addr:housenumber"] || "";
        const postcode = tags["addr:postcode"] || "";
        const address = [street, houseNr, postcode].filter(Boolean).join(" ").trim();
        const lat = el.lat ?? el.center?.lat;
        const lon = el.lon ?? el.center?.lon;
        const phone = tags.phone || tags["contact:phone"] || tags["phone:mobile"] || tags.mobile || tags["contact:mobile"] || tags["telephone"] || tags["contact:telephone"] || tags.tel;
        const officialWebsite = tags.website || tags["contact:website"] || tags.url || tags["contact:url"] || tags["contact:web"] || tags["website:official"] || tags["website:menu"];
        const socialFb = tags["contact:facebook"] || tags.facebook;
        const socialInsta = tags["contact:instagram"] || tags.instagram;
        const socialLinkedin = tags["contact:linkedin"] || tags.linkedin;
        const socialTwitter = tags["contact:twitter"] || tags.twitter;
        const website = officialWebsite || socialFb || socialInsta || socialLinkedin;
        const email = tags.email || tags["contact:email"] || tags["email:contact"];
        const openingHours = tags.opening_hours || tags["contact:opening_hours"];
        const hasDirectContact = Boolean(phone || website || email);
        if (criteria.requireContactInfo !== false && !hasDirectContact) {
          continue;
        }
        if (!hasDirectContact && (!address || address.length < 5)) {
          continue;
        }
        results.push({
          source: "osm",
          sourceId: `${el.type}/${el.id}`,
          sourceUrl: `https://www.openstreetmap.org/${el.type}/${el.id}`,
          companyName: tags.name,
          category: tags.shop || tags.amenity || tags.office || tags.craft || category,
          city: tags["addr:city"] || city,
          address: address || void 0,
          phone: phone ? String(phone).trim() : void 0,
          website: website ? String(website).trim() : void 0,
          email: email ? String(email).trim() : void 0,
          latitude: lat,
          longitude: lon,
          rawData: {
            ...el,
            chainsExcludedCount,
            openingHours,
            socialLinks: {
              facebook: socialFb,
              instagram: socialInsta,
              linkedin: socialLinkedin,
              twitter: socialTwitter
            }
          }
        });
      }
      if (results.length === 0 && (city || country) && category) {
        try {
          const nominatimLeads = await this.searchNominatim(category, city, country, limit);
          results.push(...nominatimLeads);
        } catch (e) {
          console.warn("Nominatim fallback query failed:", e.message);
        }
      }
      await logger.info("OSM", `OSM Search returned ${results.length} leads`, { criteria, count: results.length }, "OSM_API");
      return results;
    } catch (error) {
      await logger.error("OSM", "OSM Search failed completely", error, { criteria }, "OSM_API");
      if ((criteria.city || criteria.country) && criteria.category) {
        try {
          return await this.searchNominatim(criteria.category, criteria.city, criteria.country, criteria.limit || 50);
        } catch {
        }
      }
      throw new Error(`OSM Search failed: ${error.message}`);
    }
  }
  async searchNominatim(category, city, country, limit = 50) {
    const loc = [city, country].filter(Boolean).join(" ").trim();
    const cleanCat = category.trim();
    const queries = [
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanCat + " " + loc)}&format=json&addressdetails=1&limit=${limit}`,
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city || loc)}&amenity=${encodeURIComponent(cleanCat)}&format=json&addressdetails=1&limit=${limit}`,
      `https://nominatim.openstreetmap.org/search?city=${encodeURIComponent(city || loc)}&shop=${encodeURIComponent(cleanCat)}&format=json&addressdetails=1&limit=${limit}`,
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanCat + " in " + (city || loc))}&format=json&addressdetails=1&limit=${limit}`
    ];
    const leads2 = [];
    const seenNames = /* @__PURE__ */ new Set();
    for (const q of queries) {
      if (leads2.length >= limit) break;
      try {
        const res = await axios3.get(q, {
          headers: { "User-Agent": "LeadForge-Discovery/2.0" },
          timeout: 8e3
        });
        if (Array.isArray(res.data)) {
          for (const item of res.data) {
            const name = item.name || (item.display_name ? item.display_name.split(",")[0].trim() : null);
            if (!name || ValidationService.isInvalidBusinessName(name) || seenNames.has(name.toLowerCase())) continue;
            seenNames.add(name.toLowerCase());
            const addr = item.address || {};
            const street = [addr.house_number, addr.road].filter(Boolean).join(" ");
            const address = [street, addr.postcode, addr.city || addr.town || addr.village].filter(Boolean).join(", ");
            leads2.push({
              source: "osm",
              sourceId: `nominatim/${item.osm_type || "node"}/${item.osm_id}`,
              sourceUrl: `https://www.openstreetmap.org/${item.osm_type || "node"}/${item.osm_id}`,
              companyName: name,
              category: addr.shop || addr.amenity || addr.office || addr.craft || category,
              city: addr.city || addr.town || addr.village || city,
              address: address || item.display_name || void 0,
              latitude: parseFloat(item.lat),
              longitude: parseFloat(item.lon),
              rawData: item
            });
            if (leads2.length >= limit) break;
          }
        }
      } catch (e) {
        console.warn("Single Nominatim query failed:", e.message);
      }
    }
    return leads2;
  }
  async validateConfiguration() {
    return { valid: true };
  }
  getSourceName() {
    return "OpenStreetMap";
  }
  getCapabilities() {
    return ["company_name", "address", "category", "coordinates", "phone", "website"];
  }
};

// src/services/sources/registry.ts
var SourceRegistry = class {
  static {
    this.sources = {
      csv: new CSVSource(),
      osm: new OSMSource()
    };
  }
  static getSource(id) {
    const source = this.sources[id];
    if (!source) throw new Error(`Source ${id} not found`);
    return source;
  }
  static getAllSources() {
    return Object.entries(this.sources).map(([id, source]) => ({
      id,
      name: source.getSourceName(),
      capabilities: source.getCapabilities()
    }));
  }
};

// src/services/jobService.ts
init_gridPartitionService();

// src/services/identityService.ts
import * as cheerio2 from "cheerio";
var IdentityService = class {
  /**
   * Calculates a similarity score between a business name and a candidate URL/Domain.
   * Deterministic matching based on word presence, length, and city tokens.
   */
  static calculateRelevanceScore(companyName, domainOrUrl, address, city) {
    let score = 0;
    let domain = domainOrUrl.toLowerCase();
    try {
      if (domain.startsWith("http")) {
        domain = new URL(domain).hostname;
      }
    } catch {
    }
    domain = domain.replace(/^www\./, "");
    const cleanCompanyName = companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "");
    const normalizedDomain = domain.replace(/[^a-z0-9]/g, "");
    const nameWithoutSpaces = cleanCompanyName.replace(/\s+/g, "");
    if (nameWithoutSpaces.length >= 4 && normalizedDomain.includes(nameWithoutSpaces)) {
      score += 65;
    } else {
      const stopWords = /* @__PURE__ */ new Set(["the", "and", "llc", "gmbh", "sarl", "sa", "inc", "ltd", "service", "services", "shop", "store"]);
      const tokens = cleanCompanyName.split(/\s+/).filter((t) => t.length > 2 && !stopWords.has(t));
      if (tokens.length > 0) {
        let matched = 0;
        for (const token of tokens) {
          if (normalizedDomain.includes(token)) matched++;
        }
        score += Math.round(matched / tokens.length * 50);
      }
    }
    if (city) {
      const cleanCity = city.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanCity.length > 3 && normalizedDomain.includes(cleanCity)) {
        score += 15;
      }
    }
    return Math.min(score, 100);
  }
  /**
   * Determines the confidence level based on score.
   */
  static getConfidence(score) {
    if (score >= 85) return "VERIFIED";
    if (score >= 65) return "HIGH";
    if (score >= 40) return "MEDIUM";
    if (score >= 20) return "LOW";
    return "UNKNOWN";
  }
  /**
   * Deterministic check for website identity using page HTML content.
   * Matches company name tokens, phone, and city in title, headers, and footer.
   */
  static verifyIdentityOnPage(html, companyName, phone, city) {
    try {
      const $ = cheerio2.load(html);
      const title = $("title").text().toLowerCase();
      const metaDesc = $('meta[name="description"]').attr("content")?.toLowerCase() || "";
      const h1Text = $("h1").text().toLowerCase();
      const bodyText = $("body").text().toLowerCase();
      const cleanName = companyName.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
      const tokens = cleanName.split(/\s+/).filter((t) => t.length > 2);
      let score = 0;
      const matchedSignals = [];
      if (title.includes(cleanName) || h1Text.includes(cleanName)) {
        score += 55;
        matchedSignals.push("Full company name in title/h1");
      } else {
        const tokensInTitle = tokens.filter((t) => title.includes(t) || metaDesc.includes(t));
        if (tokens.length > 0 && tokensInTitle.length >= Math.ceil(tokens.length / 2)) {
          score += 35;
          matchedSignals.push(`${tokensInTitle.length}/${tokens.length} name tokens in title/meta`);
        }
      }
      if (phone) {
        const digitsOnly = phone.replace(/[^\d]/g, "");
        if (digitsOnly.length >= 7) {
          const bodyDigits = bodyText.replace(/[^\d]/g, "");
          if (bodyDigits.includes(digitsOnly)) {
            score += 35;
            matchedSignals.push(`Phone number ${phone} confirmed on page`);
          }
        }
      }
      if (city && city.length > 3) {
        if (bodyText.includes(city.toLowerCase())) {
          score += 15;
          matchedSignals.push(`City "${city}" confirmed in page body`);
        }
      }
      const confidence = this.getConfidence(score);
      return {
        match: score >= 40,
        confidence: confidence === "UNKNOWN" ? "LOW" : confidence,
        score,
        evidence: matchedSignals.join("; ") || "No identity match confirmed"
      };
    } catch {
      return { match: false, confidence: "LOW", score: 0, evidence: "HTML parsing error" };
    }
  }
};

// src/services/enrichmentBot.ts
import axios4 from "axios";
import * as cheerio3 from "cheerio";
import https2 from "https";
var EnrichmentBot = class {
  static {
    this.MAX_PAGES = 6;
  }
  static {
    this.USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 (compatible; LeadForge-Bot/2.0; +https://leadforge.app/)";
  }
  static async enrich(url) {
    const data = {
      socialLinks: {},
      evidence: [],
      allPhones: [],
      allEmails: []
    };
    const visited = /* @__PURE__ */ new Set();
    const queue = [url];
    let pagesCrawled = 0;
    const permissiveAgent = new https2.Agent({ rejectUnauthorized: false });
    let baseUrl;
    try {
      baseUrl = new URL(url);
    } catch {
      return data;
    }
    while (queue.length > 0 && pagesCrawled < this.MAX_PAGES) {
      const currentUrl = queue.shift();
      if (visited.has(currentUrl)) continue;
      visited.add(currentUrl);
      pagesCrawled++;
      try {
        const response = await axios4.get(currentUrl, {
          headers: {
            "User-Agent": this.USER_AGENT,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,de;q=0.7",
            "Cache-Control": "no-cache"
          },
          httpsAgent: permissiveAgent,
          timeout: 1e4,
          maxRedirects: 4,
          validateStatus: (status) => status >= 200 && status < 400
        });
        if (typeof response.data !== "string") continue;
        const $ = cheerio3.load(response.data);
        this.extractInfo($, currentUrl, data);
        if (pagesCrawled === 1) {
          const subpageCandidates = /* @__PURE__ */ new Set();
          $("a").each((_, el) => {
            const href = $(el).attr("href");
            const linkText = $(el).text();
            if (href && this.isLikelyContactOrInfoPage(href, linkText)) {
              try {
                const absoluteUrl = new URL(href, currentUrl).href;
                const parsed = new URL(absoluteUrl);
                if (parsed.hostname === baseUrl.hostname || parsed.hostname.endsWith("." + baseUrl.hostname.replace(/^www\./, ""))) {
                  if (!parsed.hash && !/\.(pdf|jpg|jpeg|png|gif|zip|doc)$/i.test(parsed.pathname)) {
                    subpageCandidates.add(parsed.origin + parsed.pathname);
                  }
                }
              } catch {
              }
            }
          });
          const prioritized = Array.from(subpageCandidates).slice(0, 5);
          queue.push(...prioritized);
        }
      } catch (err) {
        await logger.warn("CRAWLER", `Notice while crawling ${currentUrl}: ${err.message}`, { url }, "WEBSITE_SCRAPER");
      }
    }
    return data;
  }
  static isLikelyContactOrInfoPage(href, text2) {
    const lower = (href + " " + text2).toLowerCase();
    return lower.includes("contact") || lower.includes("contacter") || lower.includes("about") || lower.includes("propos") || lower.includes("legal") || lower.includes("imprint") || lower.includes("impressum") || lower.includes("mention") || lower.includes("kontakt") || lower.includes("nous-trouver") || lower.includes("qui-sommes-nous") || lower.includes("team") || lower.includes("equipe") || lower.includes("services") || lower.includes("info") || lower.includes("coordonnees");
  }
  static extractInfo($, url, data) {
    const bodyText = $("body").text();
    if (!data.tagline) {
      const metaDesc = $('meta[name="description"]').attr("content") || $('meta[property="og:description"]').attr("content");
      if (metaDesc && metaDesc.trim().length > 15) {
        const clean = metaDesc.trim().replace(/\s+/g, " ");
        data.tagline = clean;
        data.evidence.push({ field: "tagline", value: clean.slice(0, 200), url, method: "meta description", confidence: "HIGH" });
      }
    }
    $('script[type="application/ld+json"]').each((_, el) => {
      try {
        const jsonContent = $(el).html();
        if (!jsonContent) return;
        const parsed = JSON.parse(jsonContent);
        this.extractFromJsonLd(parsed, url, data);
      } catch {
      }
    });
    const telLinks = $('a[href^="tel:"]');
    telLinks.each((_, el) => {
      const rawTel = $(el).attr("href")?.replace("tel:", "").trim();
      if (rawTel) {
        const clean = this.cleanPhoneNumber(rawTel);
        if (clean && this.isValidPhoneNumber(clean)) {
          if (!data.phone) data.phone = clean;
          if (!data.allPhones?.includes(clean)) {
            data.allPhones?.push(clean);
            data.evidence.push({ field: "phone", value: clean, url, method: "tel link", confidence: "HIGH" });
          }
        }
      }
    });
    const textPhoneRegex = /(?:(?:\+|00)(?:[1-9]\d{0,2})[\s.-]*)?(?:\(?\d{1,4}\)?[\s.-]*)?\d{2,4}[\s.-]*\d{2,4}[\s.-]*\d{2,4}/g;
    const phoneCandidates = bodyText.match(textPhoneRegex);
    if (phoneCandidates) {
      for (const raw of phoneCandidates) {
        const clean = this.cleanPhoneNumber(raw);
        if (clean && this.isValidPhoneNumber(clean)) {
          const digits = clean.replace(/\D/g, "");
          if (digits.length >= 8 && digits.length <= 13) {
            if (!data.phone) data.phone = clean;
            if (!data.allPhones?.includes(clean) && (data.allPhones?.length || 0) < 3) {
              data.allPhones?.push(clean);
              data.evidence.push({ field: "phone", value: clean, url, method: "regex text", confidence: "MEDIUM" });
            }
          }
        }
      }
    }
    const mailtoLinks = $('a[href^="mailto:"]');
    mailtoLinks.each((_, el) => {
      const email = $(el).attr("href")?.replace("mailto:", "").split("?")[0].trim().toLowerCase();
      if (email && this.isValidEmail(email)) {
        if (!data.email) data.email = email;
        if (!data.allEmails?.includes(email)) {
          data.allEmails?.push(email);
          data.evidence.push({ field: "email", value: email, url, method: "mailto link", confidence: "HIGH" });
        }
      }
    });
    let normalizedBodyText = bodyText.replace(/\s*\[at\]\s*/gi, "@").replace(/\s*\(at\)\s*/gi, "@").replace(/\s*\[dot\]\s*/gi, ".").replace(/\s*\(dot\)\s*/gi, ".");
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const foundEmails = normalizedBodyText.match(emailRegex);
    if (foundEmails) {
      for (const candidate of foundEmails) {
        const clean = candidate.toLowerCase().trim();
        if (this.isValidEmail(clean)) {
          if (!data.email) data.email = clean;
          if (!data.allEmails?.includes(clean) && (data.allEmails?.length || 0) < 3) {
            data.allEmails?.push(clean);
            data.evidence.push({ field: "email", value: clean, url, method: "regex body text", confidence: "MEDIUM" });
          }
        }
      }
    }
    const waRegex = /(?:wa\.me\/|api\.whatsapp\.com\/send\?phone=)(\+?\d+)/;
    $('a[href*="wa.me"], a[href*="whatsapp.com"]').each((_, el) => {
      const href = $(el).attr("href") || "";
      const match = href.match(waRegex);
      if (match && !data.whatsapp) {
        data.whatsapp = match[1];
        data.evidence.push({ field: "whatsapp", value: match[1], url, method: "whatsapp CTA link", confidence: "HIGH" });
      }
    });
    if (!data.address) {
      const street = $('[itemprop="streetAddress"]').text().trim();
      const postal = $('[itemprop="postalCode"]').text().trim();
      const locality = $('[itemprop="addressLocality"]').text().trim();
      if (street || locality) {
        const fullAddr = [street, postal, locality].filter(Boolean).join(", ");
        data.address = fullAddr;
        data.evidence.push({ field: "address", value: fullAddr, url, method: "schema microdata", confidence: "HIGH" });
      }
    }
    $("a").each((_, el) => {
      const href = $(el).attr("href");
      if (!href) return;
      try {
        const lowerHref = href.toLowerCase();
        if (lowerHref.includes("facebook.com/") && !lowerHref.includes("/sharer") && !lowerHref.includes("/dialog") && !lowerHref.includes("/tr?")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.facebook) {
            data.socialLinks.facebook = cleanUrl;
            data.evidence.push({ field: "facebook", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
        if (lowerHref.includes("instagram.com/") && !lowerHref.includes("/p/") && !lowerHref.includes("/explore/")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.instagram) {
            data.socialLinks.instagram = cleanUrl;
            data.evidence.push({ field: "instagram", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
        if (lowerHref.includes("linkedin.com/company/") || lowerHref.includes("linkedin.com/in/")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.linkedin) {
            data.socialLinks.linkedin = cleanUrl;
            data.evidence.push({ field: "linkedin", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
        if ((lowerHref.includes("twitter.com/") || lowerHref.includes("x.com/")) && !lowerHref.includes("/intent") && !lowerHref.includes("/share")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.twitter) {
            data.socialLinks.twitter = cleanUrl;
            data.evidence.push({ field: "twitter", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
        if (lowerHref.includes("tiktok.com/@")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.tiktok) {
            data.socialLinks.tiktok = cleanUrl;
            data.evidence.push({ field: "tiktok", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
        if (lowerHref.includes("youtube.com/@") || lowerHref.includes("youtube.com/channel/") || lowerHref.includes("youtube.com/c/")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.youtube) {
            data.socialLinks.youtube = cleanUrl;
            data.evidence.push({ field: "youtube", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
        if (lowerHref.includes("pinterest.com/") || lowerHref.includes("pinterest.fr/")) {
          const cleanUrl = this.cleanSocialUrl(href);
          if (cleanUrl && !data.socialLinks.pinterest) {
            data.socialLinks.pinterest = cleanUrl;
            data.evidence.push({ field: "pinterest", value: cleanUrl, url, method: "page link", confidence: "HIGH" });
          }
        }
      } catch {
      }
    });
    if (url.includes("mention") || url.includes("legal") || url.includes("impressum")) {
      if (!data.siretOrVat) {
        const siretMatch = bodyText.match(/(?:siret|siren|rcs|tva|ide|vat)[\s:.-]*([0-9\s]{9,18}[0-9A-Z])/i);
        if (siretMatch && siretMatch[1]) {
          const cleanSiret = siretMatch[1].trim();
          data.siretOrVat = cleanSiret;
          data.evidence.push({ field: "legal_id", value: cleanSiret, url, method: "legal notice text", confidence: "HIGH" });
        }
      }
      if (!data.managerName) {
        const managerMatch = bodyText.match(/(?:dirigeant|gérant|directeur|responsable de la publication|geschäftsführer|managing director|ceo|fondateur)[\s:.-]*([A-Z][a-zÀ-ÿ]+(?:\s+[A-Z][a-zÀ-ÿ]+){1,3})/i);
        if (managerMatch && managerMatch[1]) {
          const manager = managerMatch[1].trim();
          if (manager.length > 3 && manager.length < 40) {
            data.managerName = manager;
            data.evidence.push({ field: "manager", value: manager, url, method: "legal notice text", confidence: "HIGH" });
          }
        }
      }
    }
  }
  static extractFromJsonLd(dataObj, url, data) {
    if (!dataObj || typeof dataObj !== "object") return;
    if (Array.isArray(dataObj)) {
      for (const item of dataObj) this.extractFromJsonLd(item, url, data);
      return;
    }
    if (dataObj["@graph"] && Array.isArray(dataObj["@graph"])) {
      for (const item of dataObj["@graph"]) this.extractFromJsonLd(item, url, data);
      return;
    }
    if (dataObj.telephone) {
      const tel = Array.isArray(dataObj.telephone) ? dataObj.telephone[0] : String(dataObj.telephone);
      const clean = this.cleanPhoneNumber(tel);
      if (clean && this.isValidPhoneNumber(clean)) {
        if (!data.phone) data.phone = clean;
        if (!data.allPhones?.includes(clean)) {
          data.allPhones?.push(clean);
          data.evidence.push({ field: "phone", value: clean, url, method: "JSON-LD Schema.org", confidence: "HIGH" });
        }
      }
    }
    if (dataObj.email) {
      const email = Array.isArray(dataObj.email) ? dataObj.email[0] : String(dataObj.email).trim().toLowerCase();
      if (this.isValidEmail(email)) {
        if (!data.email) data.email = email;
        if (!data.allEmails?.includes(email)) {
          data.allEmails?.push(email);
          data.evidence.push({ field: "email", value: email, url, method: "JSON-LD Schema.org", confidence: "HIGH" });
        }
      }
    }
    if (dataObj.address && !data.address) {
      const addr = dataObj.address;
      if (typeof addr === "string") {
        data.address = addr;
        data.evidence.push({ field: "address", value: addr, url, method: "JSON-LD Schema.org", confidence: "HIGH" });
      } else if (typeof addr === "object") {
        const street = addr.streetAddress || "";
        const postal = addr.postalCode || "";
        const locality = addr.addressLocality || "";
        const country = addr.addressCountry || "";
        const fullAddr = [street, postal, locality, country].filter(Boolean).join(", ");
        if (fullAddr.length > 5) {
          data.address = fullAddr;
          data.evidence.push({ field: "address", value: fullAddr, url, method: "JSON-LD PostalAddress", confidence: "HIGH" });
        }
      }
    }
    if (dataObj.openingHours && !data.openingHours) {
      const hours = Array.isArray(dataObj.openingHours) ? dataObj.openingHours.join(", ") : String(dataObj.openingHours);
      if (hours.length > 3) {
        data.openingHours = hours;
        data.evidence.push({ field: "opening_hours", value: hours, url, method: "JSON-LD openingHours", confidence: "HIGH" });
      }
    }
    if (dataObj.legalName && !data.legalName) {
      data.legalName = String(dataObj.legalName).trim();
      data.evidence.push({ field: "legal_name", value: data.legalName, url, method: "JSON-LD legalName", confidence: "HIGH" });
    }
    if (dataObj.sameAs) {
      const sameAsList = Array.isArray(dataObj.sameAs) ? dataObj.sameAs : [dataObj.sameAs];
      for (const item of sameAsList) {
        if (typeof item === "string") {
          const lower = item.toLowerCase();
          if (lower.includes("facebook.com") && !data.socialLinks.facebook) {
            data.socialLinks.facebook = item;
            data.evidence.push({ field: "facebook", value: item, url, method: "Schema sameAs", confidence: "HIGH" });
          } else if (lower.includes("instagram.com") && !data.socialLinks.instagram) {
            data.socialLinks.instagram = item;
            data.evidence.push({ field: "instagram", value: item, url, method: "Schema sameAs", confidence: "HIGH" });
          } else if (lower.includes("linkedin.com") && !data.socialLinks.linkedin) {
            data.socialLinks.linkedin = item;
            data.evidence.push({ field: "linkedin", value: item, url, method: "Schema sameAs", confidence: "HIGH" });
          } else if ((lower.includes("twitter.com") || lower.includes("x.com")) && !data.socialLinks.twitter) {
            data.socialLinks.twitter = item;
            data.evidence.push({ field: "twitter", value: item, url, method: "Schema sameAs", confidence: "HIGH" });
          } else if (lower.includes("tiktok.com") && !data.socialLinks.tiktok) {
            data.socialLinks.tiktok = item;
            data.evidence.push({ field: "tiktok", value: item, url, method: "Schema sameAs", confidence: "HIGH" });
          } else if (lower.includes("youtube.com") && !data.socialLinks.youtube) {
            data.socialLinks.youtube = item;
            data.evidence.push({ field: "youtube", value: item, url, method: "Schema sameAs", confidence: "HIGH" });
          }
        }
      }
    }
  }
  static cleanPhoneNumber(phone) {
    return phone.trim().replace(/\s+/g, " ");
  }
  static isValidPhoneNumber(phone) {
    const digitsOnly = phone.replace(/\D/g, "");
    if (digitsOnly.length < 7 || digitsOnly.length > 15) return false;
    if (/^(\d)\1+$/.test(digitsOnly)) return false;
    if (digitsOnly.startsWith("12345678") || digitsOnly.startsWith("012345678")) return false;
    return true;
  }
  static isValidEmail(email) {
    const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!re.test(email)) return false;
    const lower = email.toLowerCase();
    const invalidExtensions = [".png", ".jpg", ".jpeg", ".svg", ".webp", ".gif", ".css", ".js"];
    if (invalidExtensions.some((ext) => lower.endsWith(ext))) return false;
    const blockedKeywords = ["sentry", "wixpress", "example.com", "domain.com", "yourcompany", "email.com", "user@"];
    if (blockedKeywords.some((b) => lower.includes(b))) return false;
    return true;
  }
  static cleanSocialUrl(rawUrl) {
    try {
      const u = new URL(rawUrl);
      return `${u.origin}${u.pathname}`.replace(/\/$/, "");
    } catch {
      return rawUrl.split("?")[0].replace(/\/$/, "");
    }
  }
};

// src/services/search/providers.ts
import axios5 from "axios";
import * as cheerio4 from "cheerio";
import { GoogleGenAI } from "@google/genai";
var DuckDuckGoSearchProvider = class {
  getName() {
    return "DuckDuckGo";
  }
  isVerified() {
    return true;
  }
  async search(query, limit = 3) {
    try {
      const response = await axios5.post(
        "https://lite.duckduckgo.com/lite/",
        `q=${encodeURIComponent(query)}`,
        {
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9",
            "Referer": "https://duckduckgo.com/",
            "Origin": "https://lite.duckduckgo.com"
          },
          timeout: 8e3,
          validateStatus: (status) => status === 200 || status === 202
        }
      );
      if (!response.data || response.status === 202) {
        if (response.status === 202) console.warn("[DuckDuckGoSearchProvider] Received 202 Accepted - results might be delayed or throttled.");
        return [];
      }
      const $ = cheerio4.load(response.data);
      const results = [];
      const EXCLUDED_DOMAINS = [
        "duckduckgo.com",
        "wikipedia.org",
        "wikidata.org",
        "yelp.",
        "tripadvisor.",
        "yellowpages.",
        "pagesjaunes.fr",
        "facebook.com",
        "instagram.com",
        "linkedin.com",
        "twitter.com",
        "x.com",
        "pinterest.",
        "tiktok.com",
        "youtube.com",
        "mapp.apple.com"
      ];
      $("a.result-link").each((_, el) => {
        if (results.length >= limit) return false;
        const title = $(el).text().trim();
        let url = $(el).attr("href") || "";
        if (url.includes("uddg=")) {
          const match = url.match(/uddg=([^&]+)/);
          if (match) url = decodeURIComponent(match[1]);
        }
        if (url && (url.startsWith("http://") || url.startsWith("https://"))) {
          const lowerUrl = url.toLowerCase();
          const isExcluded = EXCLUDED_DOMAINS.some((d) => lowerUrl.includes(d));
          if (!isExcluded) {
            results.push({
              title,
              url,
              snippet: title,
              source: "DUCKDUCKGO_SEARCH"
            });
          }
        }
      });
      return results;
    } catch (err) {
      if (err.response?.status === 403) {
        console.warn(`[DuckDuckGoSearchProvider] Access blocked (403). Automated requests are being restricted by the provider.`);
      } else if (err.response?.status === 202) {
        console.warn(`[DuckDuckGoSearchProvider] Throttled (202). Provider is processing the request but not returning results yet.`);
      } else {
        console.warn(`[DuckDuckGoSearchProvider] Search notice: ${err.message}`);
      }
      return [];
    }
  }
};
var GeminiSearchProvider = class {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || "";
    this.ai = new GoogleGenAI({ apiKey: this.apiKey });
  }
  getName() {
    return "GeminiSearch";
  }
  isVerified() {
    return Boolean(this.apiKey);
  }
  async search(query, limit = 3) {
    if (!this.isVerified()) return [];
    try {
      const response = await this.ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: [{ role: "user", parts: [{ text: `Find the official website for this business. Return ONLY a JSON array of objects with "title" and "url" fields. Business query: ${query}. Limit to ${limit} results.` }] }],
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      const text2 = response.text;
      if (text2) {
        const items = JSON.parse(text2);
        return items.map((item) => ({
          title: item.title || "Official Website",
          url: item.url,
          snippet: item.title,
          source: "GEMINI_GOOGLE_SEARCH"
        }));
      }
      return [];
    } catch (err) {
      const isQuotaError = err.message?.includes("429") || err.status === 429 || err.message?.includes("RESOURCE_EXHAUSTED");
      if (isQuotaError) {
        console.warn("[GeminiSearchProvider] Quota exceeded (429). Falling back to other providers.");
      } else {
        console.warn(`[GeminiSearchProvider] Search failed: ${err.message}`);
      }
      return [];
    }
  }
};
var LocalWebsiteDiscoveryProvider = class {
  getName() {
    return "LocalWebsiteDiscovery";
  }
  isVerified() {
    return true;
  }
  async search(query, limit = 3) {
    const parts = query.replace(" official website", "").trim().split(" ");
    if (parts.length === 0) return [];
    const city = parts[parts.length - 1];
    const companyParts = parts.slice(0, -1).join(" ") || parts[0];
    const cleanName = companyParts.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
    if (!cleanName || cleanName.length < 3) return [];
    const tlds = [".ch", ".com", ".fr", ".de", ".co.uk", ".net", ".org"];
    const candidates = [];
    const domainRoots = [cleanName];
    const hyphenated = companyParts.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).join("-");
    if (hyphenated !== cleanName && hyphenated.length > 4) {
      domainRoots.push(hyphenated);
    }
    for (const root of domainRoots) {
      if (candidates.length >= limit) break;
      for (const tld of tlds) {
        if (candidates.length >= limit) break;
        const testUrl = `https://www.${root}${tld}`;
        try {
          const res = await axios5.get(testUrl, {
            timeout: 5e3,
            headers: {
              "User-Agent": "LeadForge-Identity-Verifier/2.0",
              "Accept": "text/html,application/xhtml+xml"
            },
            maxRedirects: 4,
            validateStatus: (status) => status >= 200 && status < 400
          });
          if (res.status >= 200 && res.status < 400 && typeof res.data === "string") {
            const verification = IdentityService.verifyIdentityOnPage(res.data, companyParts, void 0, city);
            if (verification.match || root === cleanName) {
              candidates.push({
                title: `${companyParts} Official Website`,
                url: testUrl,
                snippet: `Verified domain match: ${verification.evidence}`,
                source: "LOCAL_DOMAIN_PROBE"
              });
            }
          }
        } catch {
        }
      }
    }
    return candidates;
  }
};
var GoogleSearchProvider = class {
  constructor() {
    this.apiKey = process.env.GOOGLE_SEARCH_API_KEY || process.env.GOOGLE_CUSTOM_SEARCH_API_KEY;
    this.cx = process.env.GOOGLE_SEARCH_CX || process.env.GOOGLE_CUSTOM_SEARCH_CX;
  }
  getName() {
    return "GoogleCustomSearch";
  }
  isVerified() {
    return Boolean(this.apiKey && this.cx);
  }
  async search(query, limit = 3) {
    if (!this.isVerified()) return [];
    try {
      const response = await axios5.get("https://www.googleapis.com/customsearch/v1", {
        params: {
          key: this.apiKey,
          cx: this.cx,
          q: query,
          num: Math.min(limit, 10)
        },
        timeout: 8e3
      });
      const items = response.data?.items || [];
      return items.map((item) => ({
        title: item.title,
        url: item.link,
        snippet: item.snippet,
        source: "GOOGLE_SEARCH_API"
      }));
    } catch (err) {
      console.warn(`[GoogleSearchProvider] Query failed: ${err.message}`);
      return [];
    }
  }
};
var FirecrawlProvider = class {
  constructor() {
    this.apiKey = process.env.FIRECRAWL_API_KEY;
  }
  getName() {
    return "Firecrawl";
  }
  isVerified() {
    return Boolean(this.apiKey);
  }
  async search(query, limit = 3) {
    if (!this.isVerified()) return [];
    try {
      const response = await axios5.post(
        "https://api.firecrawl.dev/v1/search",
        { query, limit },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json"
          },
          timeout: 1e4
        }
      );
      const items = response.data?.data || [];
      return items.map((item) => ({
        title: item.title || item.metadata?.title || "Web Result",
        url: item.url,
        snippet: item.markdown?.substring(0, 160) || item.description,
        source: "FIRECRAWL_API"
      }));
    } catch (err) {
      console.warn(`[FirecrawlProvider] Search failed: ${err.message}`);
      return [];
    }
  }
};
var BingSearchProvider = class {
  constructor() {
    this.apiKey = process.env.BING_SEARCH_API_KEY;
  }
  getName() {
    return "BingSearch";
  }
  isVerified() {
    return Boolean(this.apiKey);
  }
  async search(query, limit = 3) {
    if (!this.isVerified()) return [];
    try {
      const response = await axios5.get("https://api.bing.microsoft.com/v7.0/search", {
        params: { q: query, count: limit },
        headers: { "Ocp-Apim-Subscription-Key": this.apiKey },
        timeout: 8e3
      });
      const items = response.data?.webPages?.value || [];
      return items.map((item) => ({
        title: item.name,
        url: item.url,
        snippet: item.snippet,
        source: "BING_SEARCH_API"
      }));
    } catch (err) {
      console.warn(`[BingSearchProvider] Search failed: ${err.message}`);
      return [];
    }
  }
};

// src/services/search/types.ts
var SearchProviderFactory = class {
  static {
    this.providers = [
      new GeminiSearchProvider(),
      new DuckDuckGoSearchProvider(),
      new LocalWebsiteDiscoveryProvider(),
      new GoogleSearchProvider(),
      new FirecrawlProvider(),
      new BingSearchProvider()
    ];
  }
  static registerProvider(provider) {
    this.providers.push(provider);
  }
  static getProviders() {
    return this.providers.filter((p) => p.isVerified());
  }
  static getAllProvidersStatus() {
    return this.providers.map((p) => ({
      name: p.getName(),
      verified: p.isVerified()
    }));
  }
  /**
   * Primary method to find candidate websites for a business.
   */
  static async findWebsites(companyName, city) {
    const query = `${companyName} ${city} official website`;
    const allResults = [];
    for (const provider of this.getProviders()) {
      try {
        const results = await provider.search(query, 3);
        allResults.push(...results);
      } catch (err) {
        console.error(`Search provider ${provider.getName()} failed:`, err);
      }
    }
    return allResults;
  }
};

// src/services/opportunityService.ts
init_db();
init_schema();
import { eq as eq4 } from "drizzle-orm";
var OpportunityService = class {
  static {
    this.CATEGORY_RULES = {
      "restaurant": ["BOOKING", "WHATSAPP", "LOCAL_SEO", "WEBSITE"],
      "dentist": ["BOOKING", "WHATSAPP", "LOCAL_SEO", "WEBSITE"],
      "car_repair": ["WHATSAPP", "LOCAL_SEO", "WEBSITE"],
      "plumber": ["WHATSAPP", "LOCAL_SEO", "WEBSITE"],
      "architect": ["CONTENT", "WEBSITE", "SEO"],
      "phone_repair": ["WHATSAPP", "LOCAL_SEO", "WEBSITE", "BOOKING"]
    };
  }
  static async analyzeLead(leadId) {
    const lead = await db.query.leads.findFirst({
      where: eq4(leads.id, leadId),
      with: {
        audits: {
          orderBy: (audits3, { desc: desc4 }) => [desc4(audits3.createdAt)],
          limit: 1,
          with: {
            findings: true
          }
        }
      }
    });
    if (!lead) throw new Error("Lead not found");
    const audit = lead.audits[0];
    const newOpportunities = [];
    if (lead.websiteStatus === "not_detected") {
      newOpportunities.push({
        leadId,
        type: "WEBSITE",
        title: "Website development opportunity",
        description: "The business does not appear to have an official website.",
        severity: "HIGH",
        evidence: "Discovery process failed to find a valid website candidate.",
        confidence: "HIGH",
        recommendedService: "Website Development",
        score: 40
      });
    }
    if (audit && audit.status === "completed") {
      const findings = audit.findings;
      if (audit.seoScore !== null && audit.seoScore < 70) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "SEO",
          title: "SEO Optimization",
          description: "Technical SEO issues are affecting search engine visibility.",
          severity: "MEDIUM",
          evidence: findings.filter((f) => f.category === "SEO").map((f) => f.title).join(", "),
          confidence: "HIGH",
          recommendedService: "SEO Audit & Implementation",
          score: 20
        });
      }
      const category = lead.category?.toLowerCase() || "";
      const supportsBooking = this.CATEGORY_RULES[category]?.includes("BOOKING") || findings.some((f) => f.category === "Conversion" && f.title.includes("Booking"));
      if (supportsBooking && findings.some((f) => f.title === "Booking System not detected")) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "BOOKING",
          title: "Online Booking System",
          description: "Improve customer experience by allowing direct online appointments.",
          severity: "HIGH",
          evidence: "No booking link or form detected on audited pages.",
          confidence: "MEDIUM",
          recommendedService: "Appointment Booking Integration",
          score: 25
        });
      }
      const supportsWhatsApp = this.CATEGORY_RULES[category]?.includes("WHATSAPP");
      if (supportsWhatsApp && findings.some((f) => f.title === "WhatsApp not detected")) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "WHATSAPP",
          title: "WhatsApp Contact CTA",
          description: "Increase conversions by adding a direct WhatsApp contact button.",
          severity: "MEDIUM",
          evidence: "No WhatsApp integration found on the homepage.",
          confidence: "MEDIUM",
          recommendedService: "Messaging Automation",
          score: 15
        });
      }
      if (audit.localSeoScore !== null && audit.localSeoScore < 60) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "LOCAL_SEO",
          title: "Local SEO & Schema",
          description: "Missing structured data prevents the business from ranking in map packs.",
          severity: "HIGH",
          evidence: findings.filter((f) => f.category === "Local SEO").map((f) => f.title).join(", "),
          confidence: "HIGH",
          recommendedService: "Local SEO Package",
          score: 20
        });
      }
      if (audit.performanceScore !== null && audit.performanceScore < 50) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "PERFORMANCE",
          title: "Page Speed Improvement",
          description: "Slow load times are likely increasing bounce rates.",
          severity: "MEDIUM",
          evidence: `Measured TTFB: ${audit.metrics.ttfb}ms`,
          confidence: "HIGH",
          recommendedService: "Performance Optimization",
          score: 15
        });
      }
      const hasSecurityIssue = findings.some((f) => f.category === "Security" || f.title.includes("SSL") || f.title.includes("Certificate"));
      if (hasSecurityIssue) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "SECURITY",
          title: "SSL / Security Certificate Fix",
          description: "The website has an invalid, mismatched, or expired SSL certificate triggering browser warnings.",
          severity: "CRITICAL",
          evidence: findings.filter((f) => f.category === "Security" || f.title.includes("SSL") || f.title.includes("Certificate")).map((f) => f.title).join(", "),
          confidence: "HIGH",
          recommendedService: "SSL Certificate & Domain Setup",
          score: 35
        });
      }
      const hasHostingIssue = findings.some((f) => f.title.includes("Timeout") || f.title.includes("Restricted") || f.title.includes("Server Error") || f.title.includes("Failure"));
      if (hasHostingIssue) {
        newOpportunities.push({
          leadId,
          auditId: audit.id,
          type: "TECHNICAL",
          title: "Hosting & Server Reliability Fix",
          description: "The website experiences severe server latency, timeouts, or access restrictions.",
          severity: "HIGH",
          evidence: findings.filter((f) => f.title.includes("Timeout") || f.title.includes("Restricted") || f.title.includes("Server Error") || f.title.includes("Failure")).map((f) => f.title).join(", "),
          confidence: "HIGH",
          recommendedService: "Managed Cloud Hosting & Modernization",
          score: 30
        });
      }
    }
    const totalScore = newOpportunities.reduce((sum, opt) => sum + (opt.score || 0), 0);
    await db.delete(opportunities).where(eq4(opportunities.leadId, leadId));
    if (newOpportunities.length > 0) {
      await db.insert(opportunities).values(newOpportunities.map((o) => ({
        ...o,
        score: o.score || 0
      })));
    }
    await db.update(leads).set({ opportunityScore: Math.min(100, totalScore), updatedAt: /* @__PURE__ */ new Date() }).where(eq4(leads.id, leadId));
    return {
      leadId,
      opportunityScore: totalScore,
      opportunitiesCount: newOpportunities.length,
      opportunities: newOpportunities
    };
  }
};

// src/services/socialEnrichmentService.ts
import axios6 from "axios";
import * as cheerio5 from "cheerio";
import https3 from "https";
var SocialEnrichmentService = class {
  static {
    this.CRAWLER_USER_AGENT = "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)";
  }
  static {
    this.GOOGLEBOT_USER_AGENT = "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
  }
  /**
   * Discovers and extracts real, verified information from social media profiles
   * when a local business does NOT have an official website.
   * Strictly extracts from actual public HTTP responses — ZERO fake/synthetic data.
   */
  static async enrichFromSocialMedia(companyName, city, country, existingRawTags) {
    const result = {
      socialLinks: {},
      evidence: []
    };
    if (!companyName || companyName.trim().length < 2) return result;
    if (existingRawTags) {
      this.extractSocialFromTags(existingRawTags, result);
    }
    const candidateUrls = [];
    if (result.socialLinks.facebook) candidateUrls.push({ url: result.socialLinks.facebook, platform: "facebook" });
    if (result.socialLinks.instagram) candidateUrls.push({ url: result.socialLinks.instagram, platform: "instagram" });
    if (result.socialLinks.linkedin) candidateUrls.push({ url: result.socialLinks.linkedin, platform: "linkedin" });
    if (result.socialLinks.twitter) candidateUrls.push({ url: result.socialLinks.twitter, platform: "twitter" });
    if (candidateUrls.length === 0) {
      const slugs = this.generateSocialSlugs(companyName, city);
      for (const slug of slugs.slice(0, 2)) {
        candidateUrls.push({ url: `https://www.facebook.com/${slug}`, platform: "facebook" });
        candidateUrls.push({ url: `https://www.instagram.com/${slug}/`, platform: "instagram" });
      }
    }
    const permissiveAgent = new https3.Agent({ rejectUnauthorized: false });
    for (const candidate of candidateUrls) {
      try {
        const userAgent = candidate.platform === "facebook" ? this.CRAWLER_USER_AGENT : this.GOOGLEBOT_USER_AGENT;
        const res = await axios6.get(candidate.url, {
          headers: {
            "User-Agent": userAgent,
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
            "Accept-Language": "en-US,en;q=0.9,fr;q=0.8,de;q=0.7",
            "Cache-Control": "no-cache"
          },
          httpsAgent: permissiveAgent,
          timeout: 6e3,
          maxRedirects: 3,
          validateStatus: (status) => status >= 200 && status < 400
        });
        if (typeof res.data !== "string") continue;
        const $ = cheerio5.load(res.data);
        const ogTitle = $('meta[property="og:title"]').attr("content") || $("title").text() || "";
        const ogDesc = $('meta[property="og:description"]').attr("content") || $('meta[name="description"]').attr("content") || "";
        const fullSnippet = `${ogTitle} ${ogDesc}`.trim();
        const cleanCompanyName = companyName.toLowerCase().replace(/[^a-z0-9]/g, "");
        const cleanSnippet = fullSnippet.toLowerCase().replace(/[^a-z0-9]/g, "");
        const isMatch = cleanSnippet.includes(cleanCompanyName.slice(0, Math.min(cleanCompanyName.length, 6)));
        if (!isMatch && !candidateUrls.some((c) => c.url === candidate.url)) {
          continue;
        }
        if (!result.socialUrl) {
          result.socialUrl = candidate.url;
          result.platform = candidate.platform;
        }
        if (candidate.platform && !result.socialLinks[candidate.platform]) {
          result.socialLinks[candidate.platform] = candidate.url;
          result.evidence.push({
            field: candidate.platform,
            value: candidate.url,
            url: candidate.url,
            method: "Verified Social Presence",
            confidence: "HIGH"
          });
        }
        if (!result.phone) {
          const phone = this.extractPhoneFromText(fullSnippet);
          if (phone) {
            result.phone = phone;
            result.evidence.push({
              field: "phone",
              value: phone,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: "HIGH"
            });
          }
        }
        if (!result.email) {
          const email = this.extractEmailFromText(fullSnippet);
          if (email) {
            result.email = email;
            result.evidence.push({
              field: "email",
              value: email,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: "HIGH"
            });
          }
        }
        if (!result.address && city) {
          const addr = this.extractAddressFromText(fullSnippet, city);
          if (addr) {
            result.address = addr;
            result.evidence.push({
              field: "address",
              value: addr,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Public Profile Bio`,
              confidence: "HIGH"
            });
          }
        }
        if (!result.discoveredWebsite) {
          const websiteCandidate = this.extractWebsiteFromBio(fullSnippet);
          if (websiteCandidate) {
            result.discoveredWebsite = websiteCandidate;
            result.evidence.push({
              field: "website",
              value: websiteCandidate,
              url: candidate.url,
              method: `${candidate.platform?.toUpperCase()} Bio External Link`,
              confidence: "HIGH"
            });
          }
        }
        if (ogDesc && !result.bio && ogDesc.length > 20) {
          result.bio = ogDesc.slice(0, 300).trim();
          result.evidence.push({
            field: "social_bio",
            value: result.bio,
            url: candidate.url,
            method: `${candidate.platform?.toUpperCase()} Profile Summary`,
            confidence: "HIGH"
          });
        }
      } catch (err) {
        await logger.warn("SOCIAL_SCRAPER", `Notice inspecting ${candidate.url}: ${err.message}`, { companyName }, "SOCIAL_SCRAPER");
      }
    }
    return result;
  }
  static extractSocialFromTags(tags, result) {
    const fb = tags["contact:facebook"] || tags.facebook;
    if (fb && typeof fb === "string" && fb.trim().length > 5) {
      const cleanFb = fb.startsWith("http") ? fb.trim() : `https://www.facebook.com/${fb.trim().replace(/^@/, "")}`;
      result.socialLinks.facebook = cleanFb;
      result.evidence.push({ field: "facebook", value: cleanFb, url: cleanFb, method: "OpenStreetMap contact tag", confidence: "HIGH" });
    }
    const insta = tags["contact:instagram"] || tags.instagram;
    if (insta && typeof insta === "string" && insta.trim().length > 3) {
      const cleanInsta = insta.startsWith("http") ? insta.trim() : `https://www.instagram.com/${insta.trim().replace(/^@/, "")}/`;
      result.socialLinks.instagram = cleanInsta;
      result.evidence.push({ field: "instagram", value: cleanInsta, url: cleanInsta, method: "OpenStreetMap contact tag", confidence: "HIGH" });
    }
    const linkedin = tags["contact:linkedin"] || tags.linkedin;
    if (linkedin && typeof linkedin === "string" && linkedin.trim().length > 5) {
      const cleanLi = linkedin.startsWith("http") ? linkedin.trim() : `https://www.linkedin.com/company/${linkedin.trim()}`;
      result.socialLinks.linkedin = cleanLi;
      result.evidence.push({ field: "linkedin", value: cleanLi, url: cleanLi, method: "OpenStreetMap contact tag", confidence: "HIGH" });
    }
    const twitter = tags["contact:twitter"] || tags.twitter;
    if (twitter && typeof twitter === "string" && twitter.trim().length > 2) {
      const cleanTw = twitter.startsWith("http") ? twitter.trim() : `https://x.com/${twitter.trim().replace(/^@/, "")}`;
      result.socialLinks.twitter = cleanTw;
      result.evidence.push({ field: "twitter", value: cleanTw, url: cleanTw, method: "OpenStreetMap contact tag", confidence: "HIGH" });
    }
    const phone = tags.phone || tags["contact:phone"];
    if (phone && !result.phone) {
      result.phone = String(phone).trim();
      result.evidence.push({ field: "phone", value: result.phone, url: "https://www.openstreetmap.org/", method: "OpenStreetMap contact:phone tag", confidence: "HIGH" });
    }
    const email = tags.email || tags["contact:email"];
    if (email && !result.email) {
      result.email = String(email).trim().toLowerCase();
      result.evidence.push({ field: "email", value: result.email, url: "https://www.openstreetmap.org/", method: "OpenStreetMap contact:email tag", confidence: "HIGH" });
    }
  }
  static generateSocialSlugs(companyName, city) {
    const cleanName = companyName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9\s]/g, "").trim();
    const noSpaces = cleanName.replace(/\s+/g, "");
    const hyphenated = cleanName.replace(/\s+/g, ".");
    const slugs = [noSpaces, hyphenated];
    if (city) {
      const cleanCity = city.toLowerCase().replace(/[^a-z0-9]/g, "");
      slugs.push(`${noSpaces}${cleanCity}`);
      slugs.push(`${hyphenated}.${cleanCity}`);
    }
    return slugs.filter((s) => s.length >= 4);
  }
  static extractPhoneFromText(text2) {
    const phoneRegex = /(?:(?:\+|00)(?:[1-9]\d{0,2})[\s.-]*)?(?:\(?\d{1,4}\)?[\s.-]*)?\d{2,4}[\s.-]*\d{2,4}[\s.-]*\d{2,4}/g;
    const matches = text2.match(phoneRegex);
    if (!matches) return void 0;
    for (const match of matches) {
      const digits = match.replace(/\D/g, "");
      if (digits.length >= 8 && digits.length <= 13 && !digits.startsWith("0000") && !digits.startsWith("123456")) {
        return match.trim().replace(/\s+/g, " ");
      }
    }
    return void 0;
  }
  static extractEmailFromText(text2) {
    const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
    const matches = text2.match(emailRegex);
    if (!matches) return void 0;
    for (const match of matches) {
      const email = match.toLowerCase().trim();
      if (!email.includes("facebook") && !email.includes("instagram") && !email.includes("example.com") && !email.endsWith(".png")) {
        return email;
      }
    }
    return void 0;
  }
  static extractAddressFromText(text2, city) {
    const regex = new RegExp(`(\\d{1,4}[^,\\n]{3,60}(?:street|st|rue|avenue|ave|boulevard|blvd|road|rd|chemin|strasse|str)[^,\\n]{0,40}${city})`, "i");
    const match = text2.match(regex);
    if (match && match[1]) {
      return match[1].trim().replace(/\s+/g, " ");
    }
    return void 0;
  }
  static extractWebsiteFromBio(text2) {
    const urlRegex = /(?:https?:\/\/|www\.)[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s,)]*)?/g;
    const matches = text2.match(urlRegex);
    if (!matches) return void 0;
    for (const match of matches) {
      const lower = match.toLowerCase();
      if (!lower.includes("facebook.com") && !lower.includes("instagram.com") && !lower.includes("fb.me") && !lower.includes("twitter.com") && !lower.includes("bit.ly") && !lower.includes("linktr.ee")) {
        return match.startsWith("http") ? match : `https://${match}`;
      }
    }
    return void 0;
  }
};

// src/services/jobService.ts
var JobService = class {
  static async createJob(userId, type, total) {
    const [job] = await db.insert(jobs).values({
      userId,
      type,
      total,
      status: "queued",
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
        currentStep: "Initializing pipeline...",
        currentCell: "Pending"
      }
    }).returning();
    return job;
  }
  static async updateJobProgress(jobId, progress, status = "running", results) {
    const updateData = { progress, status, updatedAt: /* @__PURE__ */ new Date() };
    if (results) updateData.results = results;
    await db.update(jobs).set(updateData).where(eq5(jobs.id, jobId));
  }
  static async failJob(jobId, error) {
    await db.update(jobs).set({ status: "failed", error, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(jobs.id, jobId));
  }
  static async resumeLeadGeneration(jobId, sourceId, criteria, campaignId) {
    return this.runLeadGeneration(jobId, sourceId, criteria, campaignId, true);
  }
  static async runLeadGeneration(jobId, sourceId, criteria, campaignId, isResume = false) {
    const startTime = Date.now();
    try {
      const job = await db.query.jobs.findFirst({ where: eq5(jobs.id, jobId) });
      if (!job) return;
      const results = job.results || {};
      const targetCount = criteria.maxResults || criteria.limit || 50;
      results.target = targetCount;
      let cells = [];
      const location = `${criteria.city || ""} ${criteria.country || ""}`.trim();
      results.currentStep = "Calculating geographic partitions...";
      await this.updateJobProgress(jobId, results.newLeadsSaved || 0, "running", results);
      const masterBbox = await GridPartitionService.getBoundingBox(location);
      if (masterBbox) {
        const divisions = GridPartitionService.calculateDivisions(masterBbox, targetCount);
        cells = GridPartitionService.partition(masterBbox, divisions);
      } else {
        cells = [null];
      }
      results.cellsTotal = cells.length;
      const startCellIdx = isResume ? results.cellsCompleted || 0 : 0;
      if (!isResume) results.cellsCompleted = 0;
      await this.updateJobProgress(jobId, results.newLeadsSaved || 0, "running", results);
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
      const MAX_TIERS = 6;
      while (totalSaved < targetCount && expansionTier <= MAX_TIERS) {
        if (expansionTier > 1 && currentMasterBbox) {
          const tierLabel = expansionTier === 2 ? "Metropolitan" : expansionTier === 3 ? "Agglomeration" : expansionTier === 4 ? "Department" : "Regional";
          results.currentStep = `Target not yet reached (${totalSaved}/${targetCount}). Expanding search to ${tierLabel} area...`;
          await this.updateJobProgress(jobId, totalSaved, "running", results);
          currentMasterBbox = GridPartitionService.expandBoundingBox(currentMasterBbox, 2.4);
          const divisions = GridPartitionService.calculateDivisions(currentMasterBbox, targetCount);
          cells = GridPartitionService.partition(currentMasterBbox, divisions);
          results.cellsTotal = cells.length;
          results.cellsCompleted = 0;
        }
        for (let cellIdx = 0; cellIdx < cells.length; cellIdx++) {
          if (totalSaved >= targetCount) break;
          const cell = cells[cellIdx];
          results.currentCell = `${cellIdx + 1}/${cells.length} (Tier ${expansionTier})`;
          results.currentStep = `Searching ${expansionTier === 1 ? "City" : expansionTier === 2 ? "Metro" : "Regional area"} (${totalSaved}/${targetCount} leads)...`;
          await this.updateJobProgress(jobId, totalSaved, "running", results);
          try {
            const needed = targetCount - totalSaved;
            const queryParams = {
              ...criteria,
              limit: Math.min(Math.max(needed + 50, 150), 300)
            };
            if (cell) queryParams.bbox = cell;
            const rawLeads = await source.search(queryParams);
            results.totalFound += rawLeads.length;
            if (rawLeads.length > 0 && rawLeads[0].rawData?.chainsExcludedCount) {
              results.chainsFiltered = (results.chainsFiltered || 0) + rawLeads[0].rawData.chainsExcludedCount;
            }
            for (const rawLead of rawLeads) {
              if (totalSaved >= targetCount) break;
              const { lead, status } = await LeadService.createLead(rawLead, campaignId, {
                requireVerifiedContact: criteria.requireContactInfo !== false
              });
              if (status === "created" && lead) {
                results.validBusinesses++;
                results.newLeadsSaved++;
                totalSaved++;
                await this.enrichLead(lead, results);
                if (totalSaved % 3 === 0 || totalSaved >= targetCount) {
                  await this.updateJobProgress(jobId, totalSaved, "running", results);
                }
              } else if (status === "rejected_unverified") {
                results.unverifiedFiltered = (results.unverifiedFiltered || 0) + 1;
              } else {
                results.duplicates++;
              }
            }
            results.cellsCompleted = cellIdx + 1;
            await this.updateJobProgress(jobId, totalSaved, "running", results);
            if (cellIdx < cells.length - 1 && totalSaved < targetCount) {
              await new Promise((resolve) => setTimeout(resolve, 400));
            }
          } catch (cellErr) {
            await logger.error("JOB", `Discovery issue in Tier ${expansionTier}: ${cellErr.message}`, cellErr, { jobId, cellIdx });
            results.cellsCompleted = cellIdx + 1;
            await this.updateJobProgress(jobId, totalSaved, "running", results);
          }
        }
        if (totalSaved < targetCount && currentMasterBbox) {
          expansionTier++;
        } else {
          break;
        }
      }
      if (totalSaved < targetCount && (criteria.city || criteria.country) && criteria.category) {
        results.currentStep = `Executing complementary discovery wave to reach ${targetCount} leads...`;
        await this.updateJobProgress(jobId, totalSaved, "running", results);
        try {
          const needed = targetCount - totalSaved;
          const loc = [criteria.city, criteria.country].filter(Boolean).join(" ");
          const categoryWords = [criteria.category];
          for (const word of categoryWords) {
            if (totalSaved >= targetCount) break;
            const fallbackLeads = await source.searchNominatim?.(word, criteria.city, criteria.country, needed + 20) || [];
            for (const rawLead of fallbackLeads) {
              if (totalSaved >= targetCount) break;
              const { lead, status } = await LeadService.createLead(rawLead, campaignId, {
                requireVerifiedContact: criteria.requireContactInfo !== false
              });
              if (status === "created" && lead) {
                results.validBusinesses++;
                results.newLeadsSaved++;
                totalSaved++;
                await this.enrichLead(lead, results);
                await this.updateJobProgress(jobId, totalSaved, "running", results);
              } else if (status === "rejected_unverified") {
                results.unverifiedFiltered = (results.unverifiedFiltered || 0) + 1;
              }
            }
          }
        } catch (e) {
          console.warn("Secondary discovery wave warning:", e.message);
        }
      }
      results.currentStep = `Completed. Discovered ${results.validBusinesses} leads.`;
      results.currentCell = "Completed";
      await this.updateJobProgress(jobId, totalSaved, "completed", results);
      await metrics.record("JOB", "LEAD_GEN", "SUCCESS", Date.now() - startTime, { jobId, totalSaved });
    } catch (error) {
      console.error("Job execution failed:", error);
      await this.failJob(jobId, error.message);
    }
  }
  static async enrichLead(lead, results) {
    try {
      let website = lead.website;
      let websiteSource = lead.source || "OpenStreetMap";
      if (!website) {
        const candidates = await SearchProviderFactory.findWebsites(lead.companyName, lead.city || "");
        if (candidates.length > 0) {
          results.websiteCandidates += candidates.length;
          for (const cand of candidates) {
            const score = IdentityService.calculateRelevanceScore(lead.companyName, cand.url, lead.address, lead.city);
            if (score >= 40) {
              website = cand.url;
              websiteSource = cand.source;
              const confidence = IdentityService.getConfidence(score);
              await db.update(leads).set({
                website: cand.url,
                websiteCandidate: cand.url,
                websiteStatus: "verified",
                websiteConfidence: confidence,
                enrichmentSource: cand.source
              }).where(eq5(leads.id, lead.id));
              await db.insert(fieldEvidence).values({
                leadId: lead.id,
                fieldName: "website",
                value: cand.url,
                source: cand.source,
                sourceUrl: cand.url,
                verified: confidence === "VERIFIED" || confidence === "HIGH",
                confidence: confidence === "VERIFIED" ? "HIGH" : confidence === "HIGH" ? "HIGH" : "MEDIUM"
              });
              results.verifiedWebsites++;
              break;
            }
          }
        }
        if (!website) {
          await db.update(leads).set({
            websiteStatus: "not_detected",
            websiteConfidence: "LOW"
          }).where(eq5(leads.id, lead.id));
        }
      } else {
        results.verifiedWebsites++;
      }
      if (website && !website.includes("facebook.com") && !website.includes("instagram.com")) {
        const enriched = await EnrichmentBot.enrich(website);
        results.pagesCrawled = (results.pagesCrawled || 0) + 1;
        if (enriched.evidence.length > 0) {
          const evidenceBatch = enriched.evidence.map((e) => ({
            leadId: lead.id,
            fieldName: e.field,
            value: e.value,
            source: "OFFICIAL_WEBSITE",
            sourceUrl: e.url,
            verified: e.confidence === "HIGH",
            confidence: e.confidence
          }));
          await db.insert(fieldEvidence).values(evidenceBatch);
          const updateObj = {
            lastEnrichedAt: /* @__PURE__ */ new Date(),
            enrichmentSource: "OFFICIAL_WEBSITE"
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
          const extraNotes = [];
          if (enriched.whatsapp) extraNotes.push(`WhatsApp: ${enriched.whatsapp}`);
          if (enriched.openingHours) extraNotes.push(`Hours: ${enriched.openingHours}`);
          if (enriched.managerName) extraNotes.push(`Dirigeant/Manager: ${enriched.managerName}`);
          if (enriched.siretOrVat) extraNotes.push(`Legal ID: ${enriched.siretOrVat}`);
          if (extraNotes.length > 0) {
            updateObj.notes = lead.notes ? `${lead.notes}
${extraNotes.join("\n")}` : extraNotes.join("\n");
          }
          await db.update(leads).set(updateObj).where(eq5(leads.id, lead.id));
        }
        try {
          await WebsiteService.performAudit(lead.id, website);
          results.auditsCompleted = (results.auditsCompleted || 0) + 1;
        } catch (auditErr) {
          console.warn(`[JobService] Audit failed for #${lead.id}: ${auditErr.message}`);
        }
      } else {
        const rawTags = lead.rawData?.tags || lead.rawData || {};
        const socialResult = await SocialEnrichmentService.enrichFromSocialMedia(
          lead.companyName,
          lead.city,
          lead.country,
          rawTags
        );
        if (socialResult.evidence.length > 0) {
          const evidenceBatch = socialResult.evidence.map((e) => ({
            leadId: lead.id,
            fieldName: e.field,
            value: e.value,
            source: socialResult.platform ? `${socialResult.platform.toUpperCase()}_PROFILE` : "SOCIAL_PRESENCE",
            sourceUrl: e.url,
            verified: e.confidence === "HIGH",
            confidence: e.confidence
          }));
          await db.insert(fieldEvidence).values(evidenceBatch);
          const updateObj = {
            lastEnrichedAt: /* @__PURE__ */ new Date(),
            enrichmentSource: "SOCIAL_MEDIA"
          };
          if (socialResult.socialUrl) {
            updateObj.website = socialResult.socialUrl;
            updateObj.websiteStatus = "social_profile";
            updateObj.websiteConfidence = "HIGH";
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
            updateObj.notes = lead.notes ? `${lead.notes}
Bio: ${socialResult.bio}` : `Bio: ${socialResult.bio}`;
          }
          await db.update(leads).set(updateObj).where(eq5(leads.id, lead.id));
        }
      }
      try {
        await OpportunityService.analyzeLead(lead.id);
        results.opportunitiesAnalyzed = (results.opportunitiesAnalyzed || 0) + 1;
      } catch (oppErr) {
        console.warn(`[JobService] Opportunity analysis failed for #${lead.id}: ${oppErr.message}`);
      }
    } catch (err) {
      console.warn(`[JobService] Lead enrichment failed for #${lead.id}: ${err.message}`);
    }
  }
  static async runCSVImport(jobId, rows, mapping, campaignId) {
    try {
      await this.updateJobProgress(jobId, 0, "running");
      const results = { imported: 0, duplicates: 0, failed: 0 };
      for (let i = 0; i < rows.length; i++) {
        try {
          const row = rows[i];
          const rawLead = {
            companyName: row[mapping.companyName],
            phone: row[mapping.phone],
            email: row[mapping.email],
            website: row[mapping.website],
            source: "CSV"
          };
          if (rawLead.companyName) {
            const { status } = await LeadService.createLead(rawLead, campaignId);
            if (status === "created") results.imported++;
            else results.duplicates++;
          }
        } catch (err) {
          console.error("CSV Import row failed:", err);
          results.failed++;
        }
        await this.updateJobProgress(jobId, i + 1);
        await db.update(jobs).set({ results }).where(eq5(jobs.id, jobId));
      }
      await db.update(jobs).set({ status: "completed", results, progress: rows.length, updatedAt: /* @__PURE__ */ new Date() }).where(eq5(jobs.id, jobId));
    } catch (error) {
      console.error("CSV Import job failed:", error);
      await this.failJob(jobId, error.message);
    }
  }
};

// src/services/aiService.ts
init_db();
init_schema();
import { GoogleGenAI as GoogleGenAI2 } from "@google/genai";
import { eq as eq6, and as and4, desc as desc2 } from "drizzle-orm";
import crypto from "crypto";
var API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GOOGLE_API_KEY || "";
var ai = new GoogleGenAI2({
  apiKey: API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var AIService = class {
  static {
    this.PROMPT_VERSION = "v1.1";
  }
  static {
    this.DEFAULT_MODEL = "gemini-3.8-flash";
  }
  static async generateAnalysis(leadId, input, language = "en", tone = "professional") {
    const startTime = Date.now();
    if (!API_KEY) {
      await logger.error("AI", "AI API Key missing", new Error("API key not configured"), { leadId }, "GEMINI_API");
      throw new Error("GEMINI_API_KEY not configured");
    }
    const inputHash = this.calculateHash(input, language, tone);
    const existing = await db.query.aiAnalyses.findFirst({
      where: and4(
        eq6(aiAnalyses.leadId, leadId),
        eq6(aiAnalyses.inputHash, inputHash)
      ),
      orderBy: [desc2(aiAnalyses.createdAt)]
    });
    if (existing) {
      await metrics.record("AI", "GEMINI", "SUCCESS", 0, { leadId, cached: true, model: this.DEFAULT_MODEL });
      return existing.result;
    }
    const prompt = this.buildPrompt(input, language, tone);
    let retries = 3;
    let delay = 2e3;
    let lastError;
    while (retries > 0) {
      try {
        const response = await ai.models.generateContent({
          model: this.DEFAULT_MODEL,
          contents: prompt,
          config: {
            responseMimeType: "application/json"
          }
        });
        const text2 = response.text;
        if (!text2) throw new Error("Empty response from Gemini");
        const parsedResult = JSON.parse(text2);
        const usage = response.usageMetadata;
        const inputTokens = usage?.promptTokenCount || 0;
        const outputTokens = usage?.candidatesTokenCount || 0;
        const totalTokens = usage?.totalTokenCount || 0;
        const cost = estimateAiCost(this.DEFAULT_MODEL, inputTokens, outputTokens);
        await db.insert(aiAnalyses).values({
          leadId,
          auditId: input.auditId || null,
          model: this.DEFAULT_MODEL,
          promptVersion: this.PROMPT_VERSION,
          inputHash,
          result: parsedResult,
          language,
          tone
        });
        await metrics.record("AI", "GEMINI", "SUCCESS", Date.now() - startTime, {
          leadId,
          model: this.DEFAULT_MODEL,
          tokens: totalTokens,
          inputTokens,
          outputTokens,
          cost
        }, totalTokens, cost);
        return parsedResult;
      } catch (error) {
        lastError = error;
        const isRateLimit = error.message?.includes("429") || error.status === 429;
        const isNotFound = error.message?.includes("404") || error.status === 404;
        if (isRateLimit && retries > 1) {
          await logger.warn("AI", `Gemini Rate Limit (429), retrying in ${delay}ms...`, { leadId, retriesLeft: retries - 1 }, "GEMINI_API");
          await new Promise((resolve) => setTimeout(resolve, delay));
          retries--;
          delay *= 2;
          continue;
        }
        if (isNotFound) {
          await logger.error("AI", `Gemini model ${this.DEFAULT_MODEL} not found or version mismatch`, error, { leadId }, "GEMINI_API");
          break;
        }
        await logger.warn("AI", `Gemini Analysis failed, applying resilient localized fallback: ${error.message}`, { leadId, language }, "GEMINI_API");
        break;
      }
    }
    const fallbackResult = this.generateFallbackAnalysis(input, language, tone);
    try {
      await db.insert(aiAnalyses).values({
        leadId,
        auditId: input.auditId || null,
        model: "fallback-deterministic",
        promptVersion: this.PROMPT_VERSION,
        inputHash,
        result: fallbackResult,
        language,
        tone
      });
    } catch {
    }
    return fallbackResult;
  }
  static calculateHash(input, language, tone) {
    const data = JSON.stringify({ input, language, tone, version: this.PROMPT_VERSION });
    return crypto.createHash("md5").update(data).digest("hex");
  }
  static buildPrompt(input, language, tone) {
    const isFrench = language.toLowerCase().startsWith("fr");
    const languageInstruction = isFrench ? `7. LANGUAGE: All output MUST be written in fluent, professional, idiomatic French (Fran\xE7ais).
Every single text field must be in French:
- "summary": R\xE9sum\xE9 ex\xE9cutif factuel de 2-3 phrases en fran\xE7ais
- "strengths": Liste des points forts r\xE9dig\xE9e en fran\xE7ais
- "weaknesses": Liste des points faibles et axes d'am\xE9lioration en fran\xE7ais
- "verified_opportunities": Liste d'opportunit\xE9s avec titre ("title"), explication ("description") et preuve ("evidence") r\xE9dig\xE9s en fran\xE7ais
- "sales_angles": Liste des angles de vente avec accroche ("angle"), valeur commerciale ("why_it_matters") et solution ("suggested_solution") r\xE9dig\xE9s en fran\xE7ais
- "outreach":
    - "email": "subject" (Objet d'e-mail captivant en fran\xE7ais) et "body" (Corps d'e-mail personnalis\xE9, poli et percutant en fran\xE7ais avec le placeholder [Votre Nom] en signature)
    - "short_message": Message court WhatsApp / SMS en fran\xE7ais
    - "linkedin": Message d'approche LinkedIn en fran\xE7ais
IMPORTANT: Ne traduisez PAS les noms propres de l'entreprise (ex: "${input.lead.companyName}") ni les adresses URL. Utilisez une formulation \xE9l\xE9gante, polie et adapt\xE9e au march\xE9 francophone.` : `7. LANGUAGE: All output must be in English. Do NOT translate company names.`;
    const toneInstruction = isFrench ? tone === "direct" ? "Le ton doit \xEAtre direct, concis et percutant." : tone === "consultative" ? "Le ton doit \xEAtre consultatif, bienveillant et orient\xE9 apport de valeur." : "Le ton doit \xEAtre professionnel, structur\xE9 et courtois." : `The requested tone is ${tone}.`;
    return `
You are an expert B2B Digital Audit Assistant. Your task is to interpret verified digital audit data for a business and provide a professional, evidence-backed summary and outreach recommendations.

STRICT ARCHITECTURE & SAFETY RULES:
1. NEVER invent facts. You are only allowed to interpret the provided data.
2. If data is NULL, UNKNOWN, NOT_MEASURED, or NOT_DETECTED, preserve that uncertainty. Use phrases like ${isFrench ? '"Non d\xE9tect\xE9", "Non mesur\xE9" ou "Donn\xE9e non v\xE9rifiable"' : '"Not detected", "Could not be verified", or "Not measured"'}.
3. NO HALLUCINATIONS: Do not invent revenue, employee counts, traffic numbers, Google rankings, or specific business problems not found in the evidence.
4. EVIDENCE LOCK: Every factual claim must be supported by the provided findings or opportunities.
5. NO UNSUPPORTED PROMISES: Do not claim that changes will "double sales" or "guarantee results". Use ${isFrench ? '"pourrait am\xE9liorer" ou "opportunit\xE9 potentielle"' : '"could improve" or "potential opportunity"'}.
6. TONE: ${toneInstruction}
${languageInstruction}

INPUT DATA:
${JSON.stringify(input, null, 2)}

OUTPUT FORMAT (JSON ONLY):
{
  "summary": "Factual 2-3 sentence summary based on the audit.",
  "strengths": ["Verified strength 1", "Verified strength 2"],
  "weaknesses": ["Verified weakness 1", "Verified weakness 2"],
  "verified_opportunities": [
    {
      "title": "Title",
      "description": "Explanation tied to evidence",
      "evidence": "Specific data point"
    }
  ],
  "sales_angles": [
    {
      "type": "SEO | Conversion | Mobile | Technique",
      "angle": "Professional Hook",
      "why_it_matters": "Business explanation",
      "suggested_solution": "Concrete next step"
    }
  ],
  "outreach": {
    "email": {
      "subject": "Compelling Subject Line",
      "body": "Personalized Email Body"
    },
    "short_message": "Concise WhatsApp/SMS Text",
    "linkedin": "LinkedIn Connection Message"
  },
  "fact_check": {
    "passed": true,
    "unsupported_claims": []
  }
}
    `;
  }
  static generateFallbackAnalysis(input, language = "fr", tone = "professional") {
    const isFrench = language.toLowerCase().startsWith("fr");
    const company = input.lead.companyName;
    const city = input.lead.city || "";
    const hasWebsite = Boolean(input.website.url);
    const score = input.audit.overallScore;
    if (isFrench) {
      const strengths = [];
      const weaknesses = [];
      if (hasWebsite) {
        strengths.push(`Site web existant et accessible (${input.website.url})`);
      }
      if (input.audit.technicalScore && input.audit.technicalScore >= 60) {
        strengths.push(`Infrastructure technique fonctionnelle (score technique ${input.audit.technicalScore}/100)`);
      }
      if (input.lead.phone) {
        strengths.push(`Ligne t\xE9l\xE9phonique directe disponible (${input.lead.phone})`);
      }
      if (!hasWebsite) {
        weaknesses.push("Aucun site web officiel d\xE9tect\xE9 lors de la v\xE9rification");
      }
      if (input.audit.mobileScore && input.audit.mobileScore < 70) {
        weaknesses.push("Exp\xE9rience mobile perfectible pour les visiteurs sur smartphone");
      }
      if (input.audit.conversionScore && input.audit.conversionScore < 60) {
        weaknesses.push("Absence d\u2019appels \xE0 l\u2019action directs ou de r\xE9servation imm\xE9diate");
      }
      if (weaknesses.length === 0) {
        weaknesses.push("Opportunit\xE9 d\u2019optimisation du r\xE9f\xE9rencement local et des conversions");
      }
      const verified_opportunities = input.opportunities && input.opportunities.length > 0 ? input.opportunities.map((o) => ({
        title: o.title,
        description: o.description,
        evidence: o.evidence || "Constat\xE9 lors de l\u2019audit technique initial"
      })) : [
        {
          title: hasWebsite ? "Optimisation du tunnel de conversion local" : "Cr\xE9ation d\u2019un site vitrine professionnel",
          description: hasWebsite ? "Faciliter la prise de contact directe depuis smartphone via WhatsApp et appel 1-clic." : "Permettre aux clients locaux de trouver imm\xE9diatement l\u2019activit\xE9 sur Google.",
          evidence: hasWebsite ? `Audit technique sur ${input.website.url}` : "Absence de nom de domaine"
        }
      ];
      const sales_angles = [
        {
          type: "Conversion",
          angle: `Capter plus de demandes directes pour ${company}${city ? " \xE0 " + city : ""}`,
          why_it_matters: "Les clients locaux recherchent de la r\xE9activit\xE9 imm\xE9diate sur leur smartphone.",
          suggested_solution: "Int\xE9grer un bouton d\u2019appel rapide et un canal WhatsApp direct sur le site."
        },
        {
          type: "SEO & Visibilit\xE9",
          angle: `Se positionner devant les concurrents locaux sur Google`,
          why_it_matters: "Une pr\xE9sence optimis\xE9e permet de g\xE9n\xE9rer des demandes entrantes r\xE9guli\xE8res.",
          suggested_solution: "Optimiser le balisage local et la fiche Google Business."
        }
      ];
      return {
        summary: `${company} est une entreprise \xE9tablie${city ? " \xE0 " + city : ""}. ${hasWebsite ? `Son site web pr\xE9sente un score global de ${score || "non \xE9valu\xE9"}/100.` : "Aucun site internet v\xE9rifi\xE9 n\u2019a \xE9t\xE9 d\xE9tect\xE9 pour cette enseigne."} Cet audit met en \xE9vidence des leviers concrets pour acc\xE9l\xE9rer l\u2019acquisition client.`,
        strengths: strengths.length > 0 ? strengths : ["Activit\xE9 locale identifi\xE9e"],
        weaknesses,
        verified_opportunities,
        sales_angles,
        outreach: {
          email: {
            subject: `Opportunit\xE9 digitale pour ${company}`,
            body: `Bonjour,

En r\xE9alisant un audit rapide de la visibilit\xE9 en ligne de ${company}${city ? " \xE0 " + city : ""}, j\u2019ai relev\xE9 2 ou 3 axes concrets qui pourraient vous permettre d\u2019attirer davantage de contacts qualifi\xE9s chaque semaine.

${hasWebsite ? "Votre site actuel a une bonne base, mais quelques ajustements (notamment sur mobile et conversion) feraient une r\xE9elle diff\xE9rence." : "Une pr\xE9sence web claire permettrait \xE0 vos clients de vous contacter sans interm\xE9diaire."}

Seriez-vous ouvert \xE0 un rapide \xE9change de 10 minutes cette semaine pour que je vous partage ces pistes ?

Bien cordialement,
[Votre Nom]`
          },
          short_message: `Bonjour, j\u2019ai analys\xE9 la pr\xE9sence en ligne de ${company}${city ? " \xE0 " + city : ""} et identifi\xE9 quelques optimisations simples pour g\xE9n\xE9rer plus d'appels directs. Seriez-vous ouvert \xE0 en discuter 5 minutes ?`,
          linkedin: `Bonjour, f\xE9licitations pour le d\xE9veloppement de ${company}. J\u2019ai relev\xE9 des points d'am\xE9lioration int\xE9ressants lors de notre audit digital local. Au plaisir d'\xE9changer !`
        },
        fact_check: {
          passed: true,
          unsupported_claims: []
        }
      };
    }
    return {
      summary: `${company} is a local business${city ? " in " + city : ""}. ${hasWebsite ? `Website recorded an overall score of ${score || "unrated"}/100.` : "No official website was detected."}`,
      strengths: [hasWebsite ? "Website online and responsive" : "Identified local business"],
      weaknesses: [hasWebsite ? "Room for conversion and SEO improvement" : "No online website presence"],
      verified_opportunities: input.opportunities.map((o) => ({ title: o.title, description: o.description, evidence: o.evidence })),
      sales_angles: [
        {
          type: "Conversion",
          angle: `Capture more direct clients for ${company}`,
          why_it_matters: "Local searchers expect instant contact options.",
          suggested_solution: "Implement instant calling and booking."
        }
      ],
      outreach: {
        email: {
          subject: `Digital growth opportunity for ${company}`,
          body: `Hi,

While conducting an audit of local businesses in ${city || "your area"}, I noticed a few quick opportunities for ${company} to capture more inbound customers.

Would you be open to a brief 10-minute chat this week?

Best regards,
[Your Name]`
        },
        short_message: `Hi, I noticed a couple of quick digital optimizations for ${company} to increase direct phone inquiries. Open to a brief chat?`,
        linkedin: `Hi, congrats on your work with ${company}. I spotted a few digital opportunities from our local audit. Would love to connect!`
      },
      fact_check: {
        passed: true,
        unsupported_claims: []
      }
    };
  }
};

// src/services/crmService.ts
init_db();
init_schema();
import { eq as eq7, and as and5 } from "drizzle-orm";
var CRMService = class {
  static async logActivity(leadId, userId, type, description, origin = "SYSTEM", metadata) {
    await db.insert(activities).values({
      leadId,
      userId,
      type,
      description,
      origin,
      metadata
    });
  }
  static async updateStatus(leadId, userId, newStatus, reason) {
    const lead = await db.query.leads.findFirst({ where: eq7(leads.id, leadId) });
    if (!lead) throw new Error("Lead not found");
    const oldStatus = lead.leadStatus;
    if (oldStatus === newStatus) return;
    await db.update(leads).set({ leadStatus: newStatus, updatedAt: /* @__PURE__ */ new Date() }).where(eq7(leads.id, leadId));
    await this.logActivity(
      leadId,
      userId,
      "STATUS_CHANGE",
      `Status changed from ${oldStatus} to ${newStatus}${reason ? `: ${reason}` : ""}`,
      "USER",
      { oldStatus, newStatus, reason }
    );
  }
  static async addNote(leadId, userId, content) {
    const [note] = await db.insert(notes).values({
      leadId,
      userId,
      content
    }).returning();
    await this.logActivity(leadId, userId, "NOTE_ADDED", "New note added", "USER", { noteId: note.id });
    return note;
  }
  static async createTask(leadId, userId, data) {
    const [task] = await db.insert(tasks).values({
      leadId,
      userId,
      title: data.title,
      dueDate: data.dueDate,
      priority: data.priority || "MEDIUM",
      status: "TODO"
    }).returning();
    await this.logActivity(leadId, userId, "TASK_CREATED", `Task created: ${data.title}`, "USER", { taskId: task.id });
    return task;
  }
  static async completeTask(taskId, userId) {
    const [task] = await db.update(tasks).set({ status: "COMPLETED", updatedAt: /* @__PURE__ */ new Date() }).where(and5(eq7(tasks.id, taskId), eq7(tasks.userId, userId))).returning();
    if (task) {
      await this.logActivity(task.leadId, userId, "TASK_COMPLETED", `Task completed: ${task.title}`, "USER", { taskId: task.id });
    }
    return task;
  }
  static async softDeleteLead(leadId, userId) {
    await db.update(leads).set({ deletedAt: /* @__PURE__ */ new Date() }).where(eq7(leads.id, leadId));
    await this.logActivity(leadId, userId, "LEAD_DELETED", "Lead moved to trash", "USER");
  }
  static async restoreLead(leadId, userId) {
    await db.update(leads).set({ deletedAt: null }).where(eq7(leads.id, leadId));
    await this.logActivity(leadId, userId, "LEAD_RESTORED", "Lead restored from trash", "USER");
  }
};

// src/app.ts
init_db();
init_schema();
import { eq as eq8, and as and6, sql as sql2, desc as desc3, isNull, isNotNull, ilike, or, gt, lt, ne } from "drizzle-orm";
import Papa from "papaparse";
dotenv.config();
var __filename2 = fileURLToPath2(import.meta.url);
var __dirname2 = path2.dirname(__filename2);
function createServerApp() {
  const app2 = express();
  app2.use(express.json());
  app2.get("/api/health", async (req, res) => {
    try {
      const { checkDbHealth: checkDbHealth2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const dbStatus = await checkDbHealth2();
      res.json({
        status: "ok",
        environment: process.env.NODE_ENV,
        database: dbStatus,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      });
    } catch (err) {
      res.status(500).json({ status: "error", error: err.message });
    }
  });
  app2.get("/api/debug/db", async (req, res) => {
    try {
      const { checkDbHealth: checkDbHealth2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const dbStatus = await checkDbHealth2();
      console.log("[DEBUG-DB] Explicit Diagnostics Triggered");
      console.log("[DEBUG-DB] Status:", dbStatus.success ? "CONNECTED" : "FAILED");
      console.log("[DEBUG-DB] Detected Host:", `${dbStatus.diagnostics?.detectedHost}:${dbStatus.diagnostics?.detectedPort}`);
      if (!dbStatus.success) {
        console.error("[DEBUG-DB] Error:", dbStatus.error);
      }
      if (dbStatus.diagnostics?.recommendation) {
        console.warn("[DEBUG-DB] Recommendation:", dbStatus.diagnostics.recommendation);
      }
      res.json({
        success: dbStatus.success,
        connected: dbStatus.connected,
        fullyProvisioned: dbStatus.fullyProvisioned,
        tables: dbStatus.tables,
        error: dbStatus.error,
        code: dbStatus.code,
        diagnostics: dbStatus.diagnostics
      });
    } catch (err) {
      console.error("[DEBUG-DB] Fatal Error:", err.message);
      res.status(500).json({
        success: false,
        error: "Database connection failed",
        hint: "This usually means your DATABASE_URL is missing or incorrect in Vercel settings.",
        details: err.message
      });
    }
  });
  app2.post("/api/debug/init-db", async (req, res) => {
    try {
      const { initDatabaseSchema: initDatabaseSchema2 } = await Promise.resolve().then(() => (init_db(), db_exports));
      const result = await initDatabaseSchema2();
      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
  app2.use("/api", (req, res, next) => {
    if (req.path === "/health" || req.path === "/debug/db" || req.path === "/debug/init-db" || req.path === "/search-providers") return next();
    requireAuth(req, res, next);
  });
  app2.get("/api/me", async (req, res) => {
    try {
      if (!req.user?.uid) {
        return res.status(401).json({ success: false, error: "Unauthorized: User identity not found in token" });
      }
      const user = await getOrCreateUser(req.user.uid, req.user.email, req.user.name);
      res.json({ success: true, data: user });
    } catch (error) {
      console.error("[API-ME] Error:", error);
      res.status(500).json({
        success: false,
        error: "Failed to retrieve user profile",
        message: error.message,
        db_connected: false
        // likely cause
      });
    }
  });
  app2.get("/api/dashboard/stats", async (req, res) => {
    try {
      if (!req.user?.uid) return res.status(401).json({ success: false, error: "Unauthorized" });
      console.log(`[DASHBOARD] Fetching stats for user UID: ${req.user.uid}`);
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { scope = "team" } = req.query;
      const filterConditions = [isNull(leads.deletedAt)];
      if (scope === "personal") {
        filterConditions.push(eq8(campaigns.userId, user.id));
      }
      const counts = await db.select({
        total: sql2`count(*)`,
        new: sql2`count(*) filter (where lead_status = 'NEW')`,
        reviewed: sql2`count(*) filter (where lead_status = 'REVIEWED')`,
        qualified: sql2`count(*) filter (where lead_status = 'QUALIFIED')`,
        contacted: sql2`count(*) filter (where lead_status = 'CONTACTED')`,
        replied: sql2`count(*) filter (where lead_status = 'REPLIED')`,
        won: sql2`count(*) filter (where lead_status = 'WON')`,
        websitesFound: sql2`count(*) filter (where website_status = 'verified')`,
        websitesMissing: sql2`count(*) filter (where website_status = 'not_detected')`,
        highOpportunity: sql2`count(*) filter (where opportunity_score > 60)`
      }).from(leads).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(and6(...filterConditions));
      const oppCounts = await db.select({
        type: opportunities.type,
        count: sql2`count(*)`
      }).from(opportunities).innerJoin(leads, eq8(opportunities.leadId, leads.id)).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(and6(...filterConditions)).groupBy(opportunities.type);
      console.log("[DASHBOARD] Stats successfully retrieved");
      res.json({
        success: true,
        data: {
          ...counts[0],
          opportunities: oppCounts
        }
      });
    } catch (error) {
      console.error("[API-DASHBOARD] Stats failure:", error);
      res.status(500).json({ success: false, error: "Failed to load dashboard stats", message: error.message, stack: process.env.NODE_ENV === "development" ? error.stack : void 0 });
    }
  });
  app2.get("/api/leads", async (req, res) => {
    try {
      if (!req.user?.uid) return res.status(401).json({ success: false, error: "Unauthorized" });
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const {
        status,
        country,
        city,
        category,
        minOppScore,
        maxOppScore,
        sortBy = "createdAt",
        sortOrder = "desc",
        page = "1",
        limit = "50",
        search,
        hasWebsite,
        scope = "team"
      } = req.query;
      const conditions = [
        isNull(leads.deletedAt)
      ];
      if (scope === "personal") {
        conditions.push(eq8(campaigns.userId, user.id));
      }
      if (status) conditions.push(eq8(leads.leadStatus, status));
      if (country) conditions.push(eq8(leads.country, country));
      if (city) conditions.push(eq8(leads.city, city));
      if (category) conditions.push(eq8(leads.category, category));
      if (minOppScore) conditions.push(gt(leads.opportunityScore, parseInt(minOppScore)));
      if (maxOppScore) conditions.push(lt(leads.opportunityScore, parseInt(maxOppScore)));
      if (hasWebsite === "true") {
        conditions.push(and6(isNotNull(leads.website), ne(leads.website, "")));
      } else if (hasWebsite === "false") {
        conditions.push(or(isNull(leads.website), eq8(leads.website, "")));
      }
      if (search) {
        conditions.push(or(
          ilike(leads.companyName, `%${search}%`),
          ilike(leads.website || "", `%${search}%`),
          ilike(leads.email || "", `%${search}%`)
        ));
      }
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const results = await db.select().from(leads).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(and6(...conditions)).orderBy(sortOrder === "desc" ? desc3(leads[sortBy]) : leads[sortBy]).limit(parseInt(limit)).offset(offset);
      res.json({ success: true, data: results.map((l) => l.leads) });
    } catch (error) {
      console.error("[API-LEADS] Fetch failure:", error);
      res.status(500).json({ success: false, error: "Failed to load leads", message: error.message });
    }
  });
  app2.get("/api/admin/monitoring-stats", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const sourceMetrics = await db.select({
        source: requestMetrics.source,
        status: requestMetrics.status,
        count: sql2`count(*)`,
        avgDuration: sql2`avg(duration_ms)`,
        lastRun: sql2`max(created_at)`
      }).from(requestMetrics).groupBy(requestMetrics.source, requestMetrics.status);
      const leadQuality = await db.select({
        total: sql2`count(*)`,
        missingPhone: sql2`count(*) filter (where phone is null)`,
        missingWebsite: sql2`count(*) filter (where website is null)`,
        missingAddress: sql2`count(*) filter (where address is null)`,
        missingCategory: sql2`count(*) filter (where category is null)`,
        verifiedWebsites: sql2`count(*) filter (where website_status = 'verified')`,
        unreachableWebsites: sql2`count(*) filter (where website_status = 'unreachable')`,
        unknownWebsites: sql2`count(*) filter (where website_status = 'unknown')`
      }).from(leads);
      const auditStats = await db.select({
        total: sql2`count(*)`,
        completed: sql2`count(*) filter (where status = 'completed')`,
        failed: sql2`count(*) filter (where status = 'failed')`,
        avgDuration: sql2`avg(extract(epoch from (completed_at - created_at)) * 1000)`,
        avgScore: sql2`avg(overall_score)`
      }).from(audits);
      const aiStats = await db.select({
        total: sql2`count(*)`,
        avgTokens: sql2`avg(token_count)`,
        totalCost: sql2`sum(estimated_cost)`,
        success: sql2`count(*) filter (where status = 'SUCCESS')`,
        failed: sql2`count(*) filter (where status = 'FAILURE')`
      }).from(requestMetrics).where(eq8(requestMetrics.category, "AI"));
      const reviewStats = await db.select({
        entityType: qualityReviews.entityType,
        isCorrect: qualityReviews.isCorrect,
        count: sql2`count(*)`
      }).from(qualityReviews).groupBy(qualityReviews.entityType, qualityReviews.isCorrect);
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
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/admin/error-logs", async (req, res) => {
    try {
      const logs = await db.select().from(systemLogs).orderBy(desc3(systemLogs.createdAt)).limit(100);
      res.json({ success: true, data: logs });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/quality-reviews", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { leadId, auditId, opportunityId, aiAnalysisId, entityType, isCorrect, errorCategory, notes: notes2 } = req.body;
      const [review] = await db.insert(qualityReviews).values({
        leadId,
        auditId,
        opportunityId,
        aiAnalysisId,
        entityType,
        isCorrect,
        errorCategory,
        notes: notes2,
        userId: user.id
      }).returning();
      res.json({ success: true, data: review });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/campaigns", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { scope = "team" } = req.query;
      const userCampaigns = scope === "personal" ? await db.select().from(campaigns).where(eq8(campaigns.userId, user.id)) : await db.select().from(campaigns);
      res.json({ success: true, data: userCampaigns });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/campaigns", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const [newCampaign] = await db.insert(campaigns).values({
        userId: user.id,
        name: req.body.name,
        industry: req.body.industry,
        location: req.body.location,
        filters: req.body.filters || {}
      }).returning();
      res.json({ success: true, data: newCampaign });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/generate", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { sourceId, criteria, campaignName, campaignId: existingCampaignId } = req.body;
      let campaignId = existingCampaignId;
      if (!campaignId && campaignName) {
        const [newCampaign] = await db.insert(campaigns).values({
          userId: user.id,
          name: campaignName,
          industry: criteria.category,
          location: criteria.city || criteria.country
        }).returning();
        campaignId = newCampaign.id;
      }
      const targetCount = criteria?.limit || criteria?.maxResults || 50;
      const job = await JobService.createJob(user.id, "LEAD_GEN", targetCount);
      JobService.runLeadGeneration(job.id, sourceId, criteria, campaignId).catch(console.error);
      res.json({ success: true, data: job });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/jobs/:id", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const job = await db.query.jobs.findFirst({
        where: and6(eq8(jobs.id, parseInt(req.params.id)), eq8(jobs.userId, user.id))
      });
      if (!job) return res.status(404).json({ success: false, error: "Job not found" });
      res.json({ success: true, data: job });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/jobs/:id/resume", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const job = await db.query.jobs.findFirst({
        where: and6(eq8(jobs.id, parseInt(req.params.id)), eq8(jobs.userId, user.id))
      });
      if (!job) return res.status(404).json({ success: false, error: "Job not found" });
      const { sourceId = "osm", criteria, campaignId } = req.body;
      JobService.resumeLeadGeneration(job.id, sourceId, criteria, campaignId).catch(console.error);
      res.json({ success: true, message: "Job resumed", data: job });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/search-providers", async (_req, res) => {
    res.json({
      success: true,
      providers: SearchProviderFactory.getAllProvidersStatus(),
      primaryDiscovery: "OpenStreetMap (Overpass API with Grid Partitioning)",
      enrichmentCrawler: "LeadForge Native Crawler (Deep Site Scanner)"
    });
  });
  app2.post("/api/leads/import", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { rows, mapping, campaignId } = req.body;
      const job = await JobService.createJob(user.id, "CSV_IMPORT", rows.length);
      JobService.runCSVImport(job.id, rows, mapping, campaignId).catch(console.error);
      res.json({ success: true, data: job });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/admin/data-quality", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const stats = await db.select({
        total: sql2`count(*)`,
        withWebsite: sql2`count(*) filter (where website is not null)`,
        verifiedWebsite: sql2`count(*) filter (where website_status = 'verified')`,
        unreachableWebsite: sql2`count(*) filter (where website_status = 'unreachable')`,
        notDetectedWebsite: sql2`count(*) filter (where website_status = 'not_detected')`,
        withPhone: sql2`count(*) filter (where phone is not null)`,
        withEmail: sql2`count(*) filter (where email is not null)`,
        audited: sql2`count(*) filter (where audit_score is not null)`,
        analyzed: sql2`count(*) filter (where lead_status != 'NEW')`
      }).from(leads).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(eq8(campaigns.userId, user.id));
      const sourceStats = await db.select({
        source: leads.source,
        count: sql2`count(*)`,
        avgOppScore: sql2`avg(opportunity_score)`
      }).from(leads).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(eq8(campaigns.userId, user.id)).groupBy(leads.source);
      res.json({ success: true, data: { overall: stats[0], sources: sourceStats } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/leads/export", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { scope = "team" } = req.query;
      const whereConditions = [isNull(leads.deletedAt)];
      if (scope === "personal") {
        whereConditions.push(eq8(campaigns.userId, user.id));
      }
      const userLeads = await db.select().from(leads).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(and6(...whereConditions));
      const flatLeads = userLeads.map((l) => l.leads);
      const csv = Papa.unparse(flatLeads);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", "attachment; filename=leads-export.csv");
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/leads/:id", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const lead = await db.query.leads.findFirst({
        where: and6(eq8(leads.id, leadId), isNull(leads.deletedAt)),
        with: {
          campaign: true,
          opportunities: true,
          audits: {
            orderBy: (audits3, { desc: desc4 }) => [desc4(audits3.createdAt)],
            with: { findings: true }
          },
          evidence: true
        }
      });
      if (!lead) {
        return res.status(404).json({ success: false, error: "Lead not found" });
      }
      res.json({ success: true, data: lead });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.patch("/api/leads/:id/status", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const { status, reason } = req.body;
      await CRMService.updateStatus(parseInt(req.params.id), user.id, status, reason);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/leads/:id/audit", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const { language = "fr", generateAi = true } = req.body;
      const lead = await db.query.leads.findFirst({ where: eq8(leads.id, leadId) });
      if (!lead) return res.status(404).json({ success: false, error: "Lead not found" });
      const langLabel = language.toLowerCase().startsWith("fr") ? "fran\xE7ais" : "english";
      await CRMService.logActivity(leadId, user.id, "AUDIT_STARTED", `Audit d\xE9marr\xE9 pour ${lead.website || "site d\xE9couvert"} (langue: ${langLabel})`, "USER");
      if (!lead.website) {
        await WebsiteService.discoverWebsite(leadId, lead.companyName, lead.city || "");
      }
      const updatedLead = await db.query.leads.findFirst({ where: eq8(leads.id, leadId) });
      if (!updatedLead?.website) {
        const results2 = await OpportunityService.analyzeLead(leadId);
        if (generateAi) {
          try {
            const aiInput = {
              auditId: null,
              lead: { companyName: updatedLead?.companyName || lead.companyName, category: updatedLead?.category || lead.category, city: updatedLead?.city || lead.city, country: updatedLead?.country || lead.country, address: updatedLead?.address || lead.address, phone: updatedLead?.phone || lead.phone, email: updatedLead?.email || lead.email, website: null, source: updatedLead?.source || lead.source },
              website: { status: "not_detected", url: null, finalUrl: null },
              audit: { overallScore: 40, technicalScore: 0, seoScore: 0, mobileScore: 0, performanceScore: 0, conversionScore: 0, localSeoScore: 0 },
              findings: [],
              opportunities: (results2.opportunities || []).map((o) => ({ type: o.type, title: o.title, description: o.description, evidence: o.evidence }))
            };
            await AIService.generateAnalysis(leadId, aiInput, language, "consultative");
          } catch (e) {
            console.warn("Fallback AI audit generation failed:", e.message);
          }
        }
        return res.json({ success: true, message: "Discovery completed, no website found.", data: results2 });
      }
      await WebsiteService.performAudit(leadId, updatedLead.website);
      const results = await OpportunityService.analyzeLead(leadId);
      if (generateAi) {
        try {
          const latestAudit = await db.query.audits.findFirst({ where: eq8(audits.leadId, leadId), orderBy: [desc3(audits.createdAt)] });
          if (latestAudit) {
            const findings = await db.query.auditFindings.findMany({ where: eq8(auditFindings.auditId, latestAudit.id) });
            const leadOpportunities = await db.query.opportunities.findMany({ where: eq8(opportunities.leadId, leadId) });
            const aiInput = {
              auditId: latestAudit.id,
              lead: { companyName: updatedLead.companyName, category: updatedLead.category, city: updatedLead.city, country: updatedLead.country, address: updatedLead.address, phone: updatedLead.phone, email: updatedLead.email, website: updatedLead.website, source: updatedLead.source },
              website: { status: updatedLead.websiteStatus, url: updatedLead.website, finalUrl: latestAudit.finalUrl },
              audit: { overallScore: latestAudit.overallScore, technicalScore: latestAudit.technicalScore, seoScore: latestAudit.seoScore, mobileScore: latestAudit.mobileScore, performanceScore: latestAudit.performanceScore, conversionScore: latestAudit.conversionScore, localSeoScore: latestAudit.localSeoScore },
              findings: findings.map((f) => ({ category: f.category, severity: f.severity, title: f.title, evidence: f.evidence })),
              opportunities: leadOpportunities.map((o) => ({ type: o.type, title: o.title, description: o.description, evidence: o.evidence }))
            };
            await AIService.generateAnalysis(leadId, aiInput, language, "consultative");
          }
        } catch (e) {
          console.warn("Auto AI generation during audit failed:", e.message);
        }
      }
      await CRMService.logActivity(leadId, user.id, "AUDIT_COMPLETED", `Audit technique et analyse commerciale finalis\xE9s (${langLabel})`, "SYSTEM");
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/leads/:id/scrape", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const lead = await db.query.leads.findFirst({ where: eq8(leads.id, leadId) });
      if (!lead) return res.status(404).json({ success: false, error: "Lead not found" });
      await CRMService.logActivity(leadId, user.id, "SCRAPE_STARTED", `Deep web and social extraction started for ${lead.companyName}`, "USER");
      let evidenceCount = 0;
      const targetUrl = lead.website;
      if (targetUrl && !targetUrl.includes("facebook.com") && !targetUrl.includes("instagram.com")) {
        const enriched = await EnrichmentBot.enrich(targetUrl);
        if (enriched.evidence.length > 0) {
          evidenceCount += enriched.evidence.length;
          const evidenceBatch = enriched.evidence.map((e) => ({
            leadId,
            fieldName: e.field,
            value: e.value,
            source: "OFFICIAL_WEBSITE",
            sourceUrl: e.url,
            verified: e.confidence === "HIGH",
            confidence: e.confidence
          }));
          await db.insert(fieldEvidence).values(evidenceBatch);
          const updateObj = { lastEnrichedAt: /* @__PURE__ */ new Date(), enrichmentSource: "OFFICIAL_WEBSITE" };
          if (!lead.phone && enriched.phone) updateObj.phone = enriched.phone;
          if (!lead.email && enriched.email) updateObj.email = enriched.email;
          if (!lead.address && enriched.address) updateObj.address = enriched.address;
          const extraNotes = [];
          if (enriched.whatsapp) extraNotes.push(`WhatsApp: ${enriched.whatsapp}`);
          if (enriched.openingHours) extraNotes.push(`Hours: ${enriched.openingHours}`);
          if (enriched.managerName) extraNotes.push(`Dirigeant/Manager: ${enriched.managerName}`);
          if (enriched.siretOrVat) extraNotes.push(`Legal ID: ${enriched.siretOrVat}`);
          if (extraNotes.length > 0) {
            updateObj.notes = lead.notes ? `${lead.notes}
${extraNotes.join("\n")}` : extraNotes.join("\n");
          }
          await db.update(leads).set(updateObj).where(eq8(leads.id, leadId));
        }
      } else {
        const rawTags = lead.rawData?.tags || lead.rawData || {};
        const socialResult = await SocialEnrichmentService.enrichFromSocialMedia(
          lead.companyName,
          lead.city || void 0,
          lead.country || void 0,
          rawTags
        );
        if (socialResult.evidence.length > 0) {
          evidenceCount += socialResult.evidence.length;
          const evidenceBatch = socialResult.evidence.map((e) => ({
            leadId,
            fieldName: e.field,
            value: e.value,
            source: socialResult.platform ? `${socialResult.platform.toUpperCase()}_PROFILE` : "SOCIAL_PRESENCE",
            sourceUrl: e.url,
            verified: e.confidence === "HIGH",
            confidence: e.confidence
          }));
          await db.insert(fieldEvidence).values(evidenceBatch);
          const updateObj = { lastEnrichedAt: /* @__PURE__ */ new Date(), enrichmentSource: "SOCIAL_MEDIA" };
          if (socialResult.socialUrl) {
            updateObj.website = socialResult.socialUrl;
            updateObj.websiteStatus = "social_profile";
            updateObj.websiteConfidence = "HIGH";
          }
          if (!lead.phone && socialResult.phone) updateObj.phone = socialResult.phone;
          if (!lead.email && socialResult.email) updateObj.email = socialResult.email;
          if (!lead.address && socialResult.address) updateObj.address = socialResult.address;
          if (socialResult.bio) {
            updateObj.notes = lead.notes ? `${lead.notes}
Bio: ${socialResult.bio}` : `Bio: ${socialResult.bio}`;
          }
          await db.update(leads).set(updateObj).where(eq8(leads.id, leadId));
        }
      }
      await CRMService.logActivity(leadId, user.id, "SCRAPE_COMPLETED", `Extracted ${evidenceCount} verified data points from ${targetUrl || "social presence"}`, "SYSTEM");
      const refreshedLead = await db.query.leads.findFirst({
        where: eq8(leads.id, leadId),
        with: { evidence: true, opportunities: true, audits: { with: { findings: true } } }
      });
      res.json({ success: true, data: refreshedLead, evidenceCount });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/leads/:id/ai", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const requestedLang = req.query.language || "";
      let analysis;
      if (requestedLang) {
        analysis = await db.query.aiAnalyses.findFirst({
          where: and6(eq8(aiAnalyses.leadId, leadId), eq8(aiAnalyses.language, requestedLang)),
          orderBy: [desc3(aiAnalyses.createdAt)]
        });
      }
      if (!analysis) {
        analysis = await db.query.aiAnalyses.findFirst({
          where: eq8(aiAnalyses.leadId, leadId),
          orderBy: [desc3(aiAnalyses.createdAt)]
        });
      }
      res.json({
        success: true,
        data: analysis ? { ...analysis.result, language: analysis.language, tone: analysis.tone } : null
      });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const aiRateLimitMap = /* @__PURE__ */ new Map();
  const AI_RATE_LIMIT_MS = 5e3;
  app2.post("/api/leads/:id/ai", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const { language = "fr", tone = "consultative", forceRegenerate = false } = req.body;
      const rateLimitKey = `${leadId}_${language}`;
      const lastRun = aiRateLimitMap.get(rateLimitKey);
      if (!forceRegenerate && lastRun && Date.now() - lastRun < AI_RATE_LIMIT_MS) {
        return res.status(429).json({ success: false, error: "Veuillez patienter quelques secondes entre chaque g\xE9n\xE9ration." });
      }
      const leadResult = await db.select().from(leads).innerJoin(campaigns, eq8(leads.campaignId, campaigns.id)).where(and6(eq8(leads.id, leadId), eq8(campaigns.userId, user.id)));
      if (leadResult.length === 0) return res.status(404).json({ success: false, error: "Lead not found" });
      aiRateLimitMap.set(rateLimitKey, Date.now());
      const lead = leadResult[0].leads;
      const latestAudit = await db.query.audits.findFirst({ where: eq8(audits.leadId, leadId), orderBy: [desc3(audits.createdAt)] });
      if (!latestAudit && lead.website) {
        await WebsiteService.performAudit(leadId, lead.website);
      }
      const refreshedAudit = latestAudit || await db.query.audits.findFirst({ where: eq8(audits.leadId, leadId), orderBy: [desc3(audits.createdAt)] });
      const findings = refreshedAudit ? await db.query.auditFindings.findMany({ where: eq8(auditFindings.auditId, refreshedAudit.id) }) : [];
      const leadOpportunities = await db.query.opportunities.findMany({ where: eq8(opportunities.leadId, leadId) });
      const aiInput = {
        auditId: refreshedAudit?.id || null,
        lead: { companyName: lead.companyName, category: lead.category, city: lead.city, country: lead.country, address: lead.address, phone: lead.phone, email: lead.email, website: lead.website, source: lead.source },
        website: { status: lead.websiteStatus, url: lead.website, finalUrl: refreshedAudit?.finalUrl || lead.website },
        audit: {
          overallScore: refreshedAudit?.overallScore ?? 45,
          technicalScore: refreshedAudit?.technicalScore ?? null,
          seoScore: refreshedAudit?.seoScore ?? null,
          mobileScore: refreshedAudit?.mobileScore ?? null,
          performanceScore: refreshedAudit?.performanceScore ?? null,
          conversionScore: refreshedAudit?.conversionScore ?? null,
          localSeoScore: refreshedAudit?.localSeoScore ?? null
        },
        findings: findings.map((f) => ({ category: f.category, severity: f.severity, title: f.title, evidence: f.evidence })),
        opportunities: leadOpportunities.map((o) => ({ type: o.type, title: o.title, description: o.description, evidence: o.evidence }))
      };
      const analysis = await AIService.generateAnalysis(leadId, aiInput, language, tone);
      await CRMService.logActivity(leadId, user.id, "AI_ANALYSIS_GENERATED", `Rapport d'audit IA g\xE9n\xE9r\xE9 (${tone}, langue: ${language})`, "AI");
      res.json({ success: true, data: { ...analysis, language, tone } });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/leads/:id/notes", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const leadNotes = await db.query.notes.findMany({
        where: eq8(notes.leadId, leadId),
        orderBy: [desc3(notes.createdAt)]
      });
      res.json({ success: true, data: leadNotes });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/leads/:id/notes", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const note = await CRMService.addNote(parseInt(req.params.id), user.id, req.body.content);
      res.json({ success: true, data: note });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/leads/:id/activities", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const leadActivities = await db.query.activities.findMany({
        where: eq8(activities.leadId, leadId),
        orderBy: [desc3(activities.createdAt)]
      });
      res.json({ success: true, data: leadActivities });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/leads/:id/activities", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const { type, description, metadata, origin } = req.body;
      const [activity] = await db.insert(activities).values({
        leadId,
        userId: user.id,
        type: type || "NOTE",
        description: description || "User activity",
        metadata: metadata || null,
        origin: origin || "USER"
      }).returning();
      res.json({ success: true, data: activity });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/leads/:id/tasks", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const leadId = parseInt(req.params.id);
      const leadTasks = await db.query.tasks.findMany({
        where: eq8(tasks.leadId, leadId),
        orderBy: [desc3(tasks.createdAt)]
      });
      res.json({ success: true, data: leadTasks });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/leads/:id/tasks", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const task = await CRMService.createTask(parseInt(req.params.id), user.id, req.body);
      res.json({ success: true, data: task });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.patch("/api/tasks/:id/complete", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const task = await CRMService.completeTask(parseInt(req.params.id), user.id);
      res.json({ success: true, data: task });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.get("/api/saved-views", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const views = await db.query.savedViews.findMany({
        where: eq8(savedViews.userId, user.id)
      });
      res.json({ success: true, data: views });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.post("/api/saved-views", async (req, res) => {
    try {
      const user = await getOrCreateUser(req.user.uid, req.user.email);
      const [view] = await db.insert(savedViews).values({
        userId: user.id,
        name: req.body.name,
        filters: req.body.filters
      }).returning();
      res.json({ success: true, data: view });
    } catch (error) {
      res.status(500).json({ success: false, error: error.message });
    }
  });
  app2.all("/api/*", (req, res) => {
    res.status(404).json({ success: false, error: `API endpoint not found: ${req.method} ${req.originalUrl}` });
  });
  return app2;
}

// src/api-entry.ts
var app = createServerApp();
async function handler(req, res) {
  try {
    let targetPath = "";
    const matchedPath = req.headers["x-matched-path"] || req.headers["x-invoke-path"] || req.headers["x-now-route-matches"];
    if (matchedPath && matchedPath !== "/api" && matchedPath !== "/api/" && matchedPath !== "/api/index.js") {
      targetPath = matchedPath;
    } else if (req.url) {
      try {
        const dummyBase = "http://localhost";
        const parsed = new URL(req.url, dummyBase);
        const customPath = parsed.searchParams.get("__path");
        if (customPath) {
          parsed.searchParams.delete("__path");
          const remainingQuery = parsed.searchParams.toString();
          targetPath = "/api/" + customPath.replace(/^\/+/, "") + (remainingQuery ? `?${remainingQuery}` : "");
        } else if (parsed.pathname.startsWith("/api") && parsed.pathname !== "/api" && parsed.pathname !== "/api/index.js") {
          targetPath = req.url;
        } else if (!parsed.pathname.startsWith("/api") && parsed.pathname !== "/") {
          targetPath = "/api" + (req.url.startsWith("/") ? req.url : "/" + req.url);
        }
      } catch {
        targetPath = req.url;
      }
    }
    if (targetPath) {
      req.url = targetPath;
    }
    return app(req, res);
  } catch (error) {
    console.error("[VERCEL-HANDLER] Invocation error:", error);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({
        success: false,
        error: "Function Invocation Error",
        message: error.message,
        code: error.code || "HANDLER_CRASH",
        env: {
          has_db_url: Boolean(
            process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.POSTGRESQL_URL || process.env.SUPABASE_DB_URL
          ),
          has_firebase_id: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
          node_env: process.env.NODE_ENV
        },
        hint: "Ensure your DATABASE_URL is set in Vercel settings and trigger a Redeploy."
      }));
    }
  }
}
export {
  handler as default
};
