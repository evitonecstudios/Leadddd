// Embedded schema DDL for automatic database provisioning on Vercel / serverless / self-hosted environments.
export const SCHEMA_SQL = `
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
