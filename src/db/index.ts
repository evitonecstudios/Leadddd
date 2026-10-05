import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema.ts';

const fullSchema = { ...schema };

declare global {
  var _postgresPool: Pool | undefined;
}

export const createPool = () => {
  if (!global._postgresPool) {
    try {
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
        console.error('Unexpected error on idle SQL pool client:', err);
      });
    } catch (error) {
      console.error('[DB-INIT] Critical failure creating Pool:', error);
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



