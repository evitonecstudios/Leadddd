import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';
import { SCHEMA_SQL } from './schemaDdl.ts';

const fullSchema = { ...schema };

declare global {
  var _postgresPool: Pool | undefined;
  var _postgresPoolKey: string | undefined;
}

export const sanitizePostgresUrl = (raw?: string): string | undefined => {
  if (!raw) return undefined;
  let trimmed = raw.trim().replace(/^["']|["']$/g, '').trim();
  // Strip accidental "DATABASE_URL=" or "psql " prefixes pasted into env UI
  trimmed = trimmed.replace(/^[A-Z0-9_]+=/, '').replace(/^psql\s+/i, '').trim();
  trimmed = trimmed.replace(/^["']|["']$/g, '').trim();
  if (!trimmed) return undefined;

  // Match: postgresql://USER:PASSWORD@HOST...
  const match = trimmed.match(/^(postgres(?:ql)?:\/\/)([^:]+):(.*)@([^@]+)$/);
  if (!match) return trimmed;
  const [, prefix, user, rawPassword, hostAndRest] = match;

  // Auto-encode special characters in password if they are unencoded
  let cleanPassword = rawPassword;
  try {
    cleanPassword = decodeURIComponent(rawPassword);
  } catch {}
  const encodedPassword = encodeURIComponent(cleanPassword);
  return `${prefix}${user}:${encodedPassword}@${hostAndRest}`;
};

export const getConnectionString = (): string | undefined => {
  const raw =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_PRISMA_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.POSTGRESQL_URL ||
    process.env.SUPABASE_DB_URL ||
    process.env.DB_URL;

  return sanitizePostgresUrl(raw);
};

export const getDbConfigError = (): string | null => {
  if (process.env.SQL_HOST || process.env.POSTGRES_HOST) return null;
  const connString = getConnectionString();
  if (!connString) {
    return 'DATABASE_URL environment variable is not defined in this runtime.';
  }
  if (/^https?:\/\//i.test(connString)) {
    return 'DATABASE_URL contient une URL HTTPS (URL de projet Supabase) au lieu de la chaîne URI PostgreSQL (postgresql://...).';
  }
  if (!/^postgres(?:ql)?:\/\//i.test(connString)) {
    return 'DATABASE_URL invalide : la valeur doit commencer par postgresql:// ou postgres://.';
  }
  if (!connString.includes('@')) {
    return 'DATABASE_URL format is invalid (missing user:password@host).';
  }
  const match = connString.match(/@([^:/?#]+)(?::(\d+))?/);
  if (!match?.[1]) {
    return 'DATABASE_URL format is invalid (missing host after @).';
  }
  return null;
};

export const hasDbConfig = (): boolean => {
  return getDbConfigError() === null;
};

const getPoolSignature = (): string => {
  const conn = getConnectionString();
  if (conn && !getDbConfigError()) return `url:${conn}`;
  if (process.env.SQL_HOST) return `sql:${process.env.SQL_HOST}:${process.env.SQL_DB_NAME || ''}`;
  if (process.env.POSTGRES_HOST) return `pg:${process.env.POSTGRES_HOST}:${process.env.POSTGRES_DATABASE || ''}`;
  return 'unconfigured';
};

export const createPool = () => {
  const sig = getPoolSignature();
  if (!global._postgresPool || global._postgresPoolKey !== sig) {
    if (global._postgresPool) {
      global._postgresPool.end().catch(() => {});
    }
    global._postgresPoolKey = sig;

    if (process.env.SQL_HOST) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 10000,
      });
    } else if (process.env.POSTGRES_HOST) {
      global._postgresPool = new Pool({
        host: process.env.POSTGRES_HOST,
        user: process.env.POSTGRES_USER || 'postgres',
        password: process.env.POSTGRES_PASSWORD,
        database: process.env.POSTGRES_DATABASE || 'postgres',
        ssl: process.env.POSTGRES_HOST.includes('localhost') ? false : { rejectUnauthorized: false },
        max: process.env.VERCEL ? 3 : 10,
        connectionTimeoutMillis: 8000,
        idleTimeoutMillis: 30000,
      });
    } else {
      const connString = getConnectionString();
      if (connString && !getDbConfigError()) {
        const isLocal = connString.includes('localhost') || connString.includes('127.0.0.1');
        global._postgresPool = new Pool({
          connectionString: connString,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: process.env.VERCEL ? 3 : 10,
          connectionTimeoutMillis: 8000,
          idleTimeoutMillis: 30000,
        });
      } else {
        global._postgresPool = new Pool({
          host: '127.0.0.1',
          database: 'postgres',
          max: 2,
          connectionTimeoutMillis: 1500,
        });
      }
    }

    global._postgresPool.on('error', (err) => {
      console.error('[DB-POOL] Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Initialize pool on load (after dotenv/config has executed)
createPool();
export const db = drizzle(global._postgresPool!, { schema: fullSchema });

export async function initDatabaseSchema() {
  const cfgError = getDbConfigError();
  if (cfgError) {
    return {
      success: false,
      error: cfgError,
    };
  }
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
  const connString = getConnectionString();
  const explicitHost = process.env.SQL_HOST || process.env.POSTGRES_HOST;
  const cfgError = getDbConfigError();

  let hostInfo = explicitHost || '(non configuré)';
  let portInfo = '5432';
  let isSupabasePooler = false;
  let isDirectSupabase = false;

  if (connString) {
    try {
      const match = connString.match(/@([^:/?#]+)(?::(\d+))?/);
      if (match) {
        hostInfo = match[1];
        portInfo = match[2] || '5432';
      } else {
        hostInfo = /^https?:\/\//i.test(connString)
          ? '(URL HTTPS collée au lieu de postgresql://)'
          : '(URL invalide — @ manquant)';
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
      hasConnectionString: Boolean(connString || explicitHost),
      detectedHost: hostInfo,
      detectedPort: portInfo,
      isSupabasePooler,
      isDirectSupabaseWarning: isDirectSupabase ? 'Direct Supabase connection (port 5432) uses IPv6 which fails on Vercel. Switch to Connection Pooler (port 6543).' : null,
      recommendation: null as string | null,
    }
  };

  if (cfgError) {
    result.error = cfgError;
    result.code = (!connString && !explicitHost) ? 'NO_DATABASE_URL' : 'INVALID_DATABASE_URL';
    if (result.code === 'NO_DATABASE_URL') {
      result.diagnostics.recommendation = process.env.VERCEL
        ? 'Dans Vercel -> Settings -> Environment Variables, ajoutez DATABASE_URL (URI du Transaction Pooler Supabase, port 6543) pour Production/Preview/Development, puis cliquez sur Deployments -> Redeploy.'
        : 'La variable DATABASE_URL est absente de cet environnement. Ajoutez DATABASE_URL (URI du Transaction Pooler Supabase, port 6543) dans les variables/Secrets de votre déploiement puis redémarrez.';
    } else {
      result.diagnostics.recommendation = 'Dans Supabase -> bouton "Connect" (en haut) -> onglet "Connection string" -> Method: "Transaction pooler" -> copiez la chaîne complète : postgresql://postgres.<ref>:[YOUR-PASSWORD]@aws-0-<region>.pooler.supabase.com:6543/postgres, remplacez [YOUR-PASSWORD] par votre mot de passe DB, collez-la dans Vercel -> Settings -> Environment Variables (DATABASE_URL), puis cliquez sur Deployments -> Redeploy.';
    }
    return result;
  }

  const p = createPool();

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
    const msgLower = (err.message || '').toLowerCase();

    // Provide intelligent, actionable advice based on PostgreSQL error code or message
    if (msgLower.includes('tenant/user') && msgLower.includes('not found')) {
      const refMatch = err.message.match(/postgres\.([a-z0-9]+)/i);
      const refLabel = refMatch?.[1] ? ` (${refMatch[1]})` : '';
      result.diagnostics.recommendation = `Erreur Supabase Pooler : le projet${refLabel} est introuvable, mis en pause ou supprimé, ou l'URL du pooler (région aws-0/aws-1) ne correspond pas. Vérifiez votre projet actif dans Supabase -> Connect -> Transaction Pooler (port 6543), mettez à jour DATABASE_URL dans Vercel -> Settings -> Environment Variables, puis faites Deployments -> Redeploy.`;
    } else if (err.code === 'ECONNREFUSED') {
      result.diagnostics.recommendation = 'Connexion refusée. En environnement cloud/Vercel, localhost n’est pas disponible : vérifiez que DATABASE_URL pointe vers Supabase (port 6543) et redeployez.';
    } else if (err.code === 'ETIMEDOUT' || msgLower.includes('timeout')) {
      result.diagnostics.recommendation = isDirectSupabase
        ? 'Timeout de connexion sur le port direct 5432 (IPv6 bloqué en serverless). Utilisez l’URL du Transaction Pooler Supabase sur le port 6543 (aws-*.pooler.supabase.com:6543).'
        : 'Timeout de connexion à la base de données. Vérifiez que DATABASE_URL est bien définie sur Vercel (Transaction Pooler port 6543), que le projet Supabase n’est pas en pause, puis faites Redeploy.';
    } else if (err.code === '28P01' || msgLower.includes('password')) {
      result.diagnostics.recommendation = 'Authentification échouée. Vérifiez le mot de passe dans DATABASE_URL (encodez les caractères spéciaux comme @ en %40).';
    } else if (err.code === 'ENOTFOUND') {
      result.diagnostics.recommendation = 'Nom d’hôte introuvable. Vérifiez le domaine dans DATABASE_URL.';
    }

    return result;
  }
}
