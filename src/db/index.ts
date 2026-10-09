import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { SCHEMA_SQL } from './schemaDdl.ts';

const fullSchema = { ...schema };

declare global {
  var _postgresPool: Pool | undefined;
}

export const getConnectionString = (): string | undefined => {
  const raw = 
    process.env.DATABASE_URL || 
    process.env.POSTGRES_URL || 
    process.env.POSTGRESQL_URL || 
    process.env.SUPABASE_DB_URL || 
    process.env.DB_URL;
    
  if (!raw) return undefined;
  // Clean surrounding single/double quotes and whitespace that users often accidentally paste
  return raw.trim().replace(/^["']|["']$/g, '');
};

export const createPool = () => {
  if (!global._postgresPool) {
    if (process.env.SQL_HOST) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 10000,
      });
    } else {
      const connString = getConnectionString();
      if (connString) {
        const isLocal = connString.includes('localhost') || connString.includes('127.0.0.1');
        global._postgresPool = new Pool({
          connectionString: connString,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: process.env.VERCEL ? 3 : 10,
          connectionTimeoutMillis: 5000,
          idleTimeoutMillis: 30000,
        });
      } else {
        global._postgresPool = new Pool({
          host: 'localhost',
          database: 'postgres',
          max: 5,
          connectionTimeoutMillis: 3000,
        });
      }
    }

    global._postgresPool.on('error', (err) => {
      console.error('[DB-POOL] Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Initialize pool lazily on first use or explicitly here
createPool();
const pool = global._postgresPool!;
export const db = drizzle(pool, { schema: fullSchema });

export async function initDatabaseSchema() {
  const p = createPool();
  try {
    await p.query(SCHEMA_SQL);
    console.log('[DB-INIT] Successfully applied schema DDL (17 tables + indexes)');
    return { success: true, message: 'All 17 database tables and indexes initialized successfully.' };
  } catch (err: any) {
    console.error('[DB-INIT] Failed to apply schema DDL:', err);
    return { success: false, error: err.message };
  }
}

export async function checkDbHealth() {
  const p = createPool();
  const connString = getConnectionString();
  
  let hostInfo = 'localhost';
  let portInfo = '5432';
  let isSupabasePooler = false;
  let isDirectSupabase = false;

  if (connString) {
    try {
      const match = connString.match(/@([^:/]+)(?::(\d+))?/);
      if (match) {
        hostInfo = match[1];
        portInfo = match[2] || '5432';
      }
      isSupabasePooler = hostInfo.includes('pooler.supabase.com') || portInfo === '6543';
      isDirectSupabase = hostInfo.includes('supabase.co') && portInfo === '5432';
    } catch {}
  }

  const result = {
    success: false,
    connected: false,
    fullyProvisioned: false,
    tables: 0,
    error: null as string | null,
    code: null as string | null,
    diagnostics: {
      hasConnectionString: Boolean(connString),
      detectedHost: hostInfo,
      detectedPort: portInfo,
      isSupabasePooler,
      isDirectSupabaseWarning: isDirectSupabase ? 'Direct Supabase connection (port 5432) uses IPv6 which fails on Vercel. Switch to Connection Pooler (port 6543).' : null,
      recommendation: null as string | null,
    }
  };

  if (!connString && (process.env.VERCEL || process.env.NODE_ENV === 'production')) {
    result.error = 'DATABASE_URL environment variable is not defined.';
    result.code = 'NO_DATABASE_URL';
    result.diagnostics.recommendation = 'In Vercel -> Project Settings -> Environment Variables, add DATABASE_URL (Supabase Transaction Pooler port 6543), then trigger a Redeploy.';
    return result;
  }

  try {
    const res = await p.query('SELECT 1');
    result.connected = res.rowCount === 1;
    result.success = result.connected;
    
    // Check tables
    const tableRes = await p.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    result.tables = parseInt(tableRes.rows[0].count);
    
    // If connected but tables are missing, auto-initialize them!
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
  } catch (err: any) {
    result.error = err.message;
    result.code = err.code;

    // Provide intelligent, actionable advice based on PostgreSQL error code
    if (err.code === 'ECONNREFUSED') {
      result.diagnostics.recommendation = 'Connection refused. If on Vercel, localhost is not available. Please set DATABASE_URL with a cloud database (e.g. Supabase or Neon).';
    } else if (err.code === 'ETIMEDOUT') {
      result.diagnostics.recommendation = 'Connection timed out. On Supabase, use the Transaction Pooler URL (port 6543 with aws-0-*.pooler.supabase.com), not direct port 5432.';
    } else if (err.code === '28P01' || err.message?.includes('password')) {
      result.diagnostics.recommendation = 'Password authentication failed. Check your database password. If it contains special characters (@, #, !, $), URL-encode them (e.g., %40).';
    } else if (err.code === 'ENOTFOUND') {
      result.diagnostics.recommendation = 'Host address not found. Double check your DATABASE_URL host domain.';
    }

    return result;
  }
}
