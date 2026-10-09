import type { IncomingMessage, ServerResponse } from 'http';
import { createServerApp } from '../src/app.ts';

// Initialize the Express app once so it stays warm across serverless invocations
const app = createServerApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // In Vercel rewrites, x-matched-path contains the original requested path (e.g., /api/dashboard/stats)
    const matchedPath = (req.headers['x-matched-path'] as string) || 
                        (req.headers['x-now-route-matches'] as string);

    if (matchedPath && matchedPath.startsWith('/api') && (req.url === '/api' || req.url === '/api/')) {
      req.url = matchedPath;
    } else if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }

    return (app as any)(req, res);
  } catch (error: any) {
    console.error('[VERCEL-HANDLER] Invocation error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Function Invocation Error',
      message: error.message,
      code: error.code || 'HANDLER_CRASH',
      env: {
        has_db_url: Boolean(
          process.env.DATABASE_URL || 
          process.env.POSTGRES_URL || 
          process.env.POSTGRESQL_URL || 
          process.env.SUPABASE_DB_URL
        ),
        has_firebase_id: Boolean(process.env.FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID),
        node_env: process.env.NODE_ENV
      },
      hint: 'Ensure your DATABASE_URL is set in Vercel and your Supabase connection pooler port is 6543.'
    }));
  }
}
