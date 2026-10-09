import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

const fullSchema = { ...schema };

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    if (process.env.SQL_HOST) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 15000,
      });
    } else {
      const connString = process.env.DATABASE_URL || process.env.POSTGRES_URL;
      if (connString) {
        const isLocal = connString.includes('localhost') || connString.includes('127.0.0.1');
        global._postgresPool = new Pool({
          connectionString: connString,
          ssl: isLocal ? false : { rejectUnauthorized: false },
          max: 10,
          connectionTimeoutMillis: 15000,
        });
      } else {
        global._postgresPool = new Pool({
          host: 'localhost',
          database: 'postgres',
          max: 10,
          connectionTimeoutMillis: 15000,
        });
      }
    }

    global._postgresPool.on('error', (err) => {
      console.error('Unexpected error on idle SQL pool client:', err);
    });
  }
  return global._postgresPool;
};

// Initialize pool lazily on first use or explicitly here
createPool();
const pool = global._postgresPool!;
export const db = drizzle(pool, { schema: fullSchema });

export async function checkDbHealth() {
  const result = {
    success: false,
    connected: false,
    fullyProvisioned: false,
    tables: 0,
    error: null as string | null,
    code: null as string | null,
    diagnostics: {
      urlPattern: 'HIDDEN',
      mismatches: [] as string[]
    }
  };

  try {
    const res = await pool.query('SELECT 1');
    result.connected = res.rowCount === 1;
    result.success = result.connected;
    
    // Check tables
    const tableRes = await pool.query(`
      SELECT count(*) FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    result.tables = parseInt(tableRes.rows[0].count);
    result.fullyProvisioned = result.tables >= 5; // Basic heuristic
    
    return result;
  } catch (err: any) {
    result.error = err.message;
    result.code = err.code;
    return result;
  }
}

