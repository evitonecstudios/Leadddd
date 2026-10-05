import { defineConfig } from "drizzle-kit";
import * as dotenv from "dotenv";

dotenv.config();

const sqlHost = process.env.SQL_HOST;
const sqlDbName = process.env.SQL_DB_NAME;
const user = process.env.SQL_ADMIN_USER;
const password = process.env.SQL_ADMIN_PASSWORD;

if (!sqlHost || !sqlDbName || !user || !password) {
  // During build or before setup, these might be missing.
  // We throw only if we are actually trying to run migrations.
}

const databaseUrl = process.env.DATABASE_URL || process.env.POSTGRES_URL;

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  schemaFilter: ["public"],
  dbCredentials: databaseUrl
    ? {
        url: databaseUrl,
        ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false },
      }
    : {
        host: sqlHost || 'localhost',
        user: user || 'admin',
        password: password || 'password',
        database: sqlDbName || 'leadforge',
        ssl: false,
      },
  verbose: true,
});
