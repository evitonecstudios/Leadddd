import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql } from 'drizzle-orm';
import * as schema from './schema';

const fullSchema = { ...schema };

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    try {
      const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      console.log('[DB-INIT] Initializing SQL pool...');
      
      if (connString) {
        const isLocal = connString.includes('localhost') || connString.includes('127.0.0.1');
        const isSupabase = connString.includes('supabase.com');
        const isPooler = connString.includes(':6543');
        
        console.log(`[DB-INIT] Using connection string (Local: ${isLocal}, Supabase: ${isSupabase}, Pooler: ${isPooler})`);
        
        global._postgresPool = new Pool({
          connectionString: connString,
          // Supabase pooler (6543) requires SSL. rejectUnauthorized: false is common for serverless environments.
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: isPooler ? 5 : 10, // Lower max connections for serverless
          connectionTimeoutMillis: 20000,
          idleTimeoutMillis: 30000,
        });
      } else {
        const isVercel = Boolean(process.env.VERCEL);
        console.log(`[DB-INIT] No connection string found. Vercel: ${isVercel}`);
        if (isVercel && process.env.SQL_HOST?.includes('cloudsql')) {
          console.warn('[DB-INIT] WARNING: Attempting to use Cloud SQL Unix socket on Vercel without connection string. This will likely fail.');
        }

        global._postgresPool = new Pool({
          host: process.env.SQL_HOST,
          user: process.env.SQL_USER,
          password: process.env.SQL_PASSWORD,
          database: process.env.SQL_DB_NAME,
          ssl: process.env.SQL_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
          max: 10,
          connectionTimeoutMillis: 15000,
        });
      }

      global._postgresPool.on('error', (err) => {
        console.error('[DB-POOL] Unexpected error on idle client:', err);
      });
    } catch (error: any) {
      console.error('[DB-INIT] Critical failure during pool creation:', error.message);
      // Create a dummy pool that will fail on use but won't crash the entire app on load
      global._postgresPool = new Pool({ max: 0 });
    }
  }
  return global._postgresPool;
};

// Internal instance to be initialized lazily
let _db: any = null;

export const getDb = () => {
  if (!_db) {
    const pool = createPool();
    _db = drizzle(pool, { schema: fullSchema });
  }
  return _db;
};

// Export a proxy that mimics the db object but initializes on first access
export const db = new Proxy({} as any, {
  get(target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  }
});

/**
 * Diagnostic helper to check if the database is reachable and if tables are provisioned.
 * Useful for debugging 500 errors on Vercel/Supabase.
 */
export const checkDbHealth = async () => {
  const envVars = {
    DATABASE_URL: Boolean(process.env.DATABASE_URL),
    POSTGRES_URL: Boolean(process.env.POSTGRES_URL),
    SQL_HOST: Boolean(process.env.SQL_HOST),
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: Boolean(process.env.VERCEL)
  };

  const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
  const urlPattern = connString 
    ? `${connString.split('://')[0]}://***:***@${connString.split('@')[1]?.split('/')[0]}/${connString.split('/').pop()?.split('?')[0]}`
    : 'MISSING';

  const mismatches: string[] = [];
  if (process.env.VERCEL && !process.env.DATABASE_URL && process.env.POSTGRES_URL) {
    mismatches.push('Using Vercel POSTGRES_URL instead of DATABASE_URL. Ensure Drizzle is configured for the correct variable.');
  }
  if (connString?.includes('supabase.com') && !connString.includes('sslmode=require') && !connString.includes(':6543')) {
    mismatches.push('Supabase connection may require sslmode=require or use of the transaction pooler (port 6543).');
  }

  try {
    const start = Date.now();
    // Basic connectivity check
    await getDb().execute(sql`SELECT 1 as ping`);
    
    // Check for critical tables to see if schema was applied
    const tables = ['users', 'leads', 'campaigns', 'jobs'];
    const status: Record<string, boolean> = {};
    
    for (const table of tables) {
      try {
        await getDb().execute(sql`SELECT 1 FROM ${sql.identifier(table)} LIMIT 1`);
        status[table] = true;
      } catch {
        status[table] = false;
      }
    }

    return { 
      success: true, 
      latencyMs: Date.now() - start,
      connected: true,
      tables: status,
      fullyProvisioned: Object.values(status).every(v => v === true),
      diagnostics: {
        envVars,
        urlPattern,
        mismatches,
        poolStatus: global._postgresPool ? 'Initialized' : 'Not Initialized'
      }
    };
  } catch (error: any) {
    return { 
      success: false, 
      connected: false, 
      error: error.message,
      code: error.code,
      diagnostics: {
        envVars,
        urlPattern,
        mismatches,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      }
    };
  }
};



