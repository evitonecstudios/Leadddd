import type { IncomingMessage, ServerResponse } from 'http';
import { createServerApp } from './app.ts';

// Initialize Express instance once to keep it warm across serverless invocations
const app = createServerApp();

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    let targetPath = '';

    // Check matched path headers from Vercel edge/routing
    const matchedPath = (req.headers['x-matched-path'] as string) || 
                        (req.headers['x-invoke-path'] as string) ||
                        (req.headers['x-now-route-matches'] as string);

    if (matchedPath && matchedPath !== '/api' && matchedPath !== '/api/' && matchedPath !== '/api/index.js') {
      targetPath = matchedPath;
    } else if (req.url) {
      try {
        const dummyBase = 'http://localhost';
        const parsed = new URL(req.url, dummyBase);
        const customPath = parsed.searchParams.get('__path');
        if (customPath) {
          parsed.searchParams.delete('__path');
          const remainingQuery = parsed.searchParams.toString();
          targetPath = '/api/' + customPath.replace(/^\/+/, '') + (remainingQuery ? `?${remainingQuery}` : '');
        } else if (parsed.pathname.startsWith('/api') && parsed.pathname !== '/api' && parsed.pathname !== '/api/index.js') {
          targetPath = req.url;
        } else if (!parsed.pathname.startsWith('/api') && parsed.pathname !== '/') {
          targetPath = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
        }
      } catch {
        targetPath = req.url;
      }
    }

    if (targetPath) {
      req.url = targetPath;
    }

    return (app as any)(req, res);
  } catch (error: any) {
    console.error('[VERCEL-HANDLER] Invocation error:', error);
    if (!res.headersSent) {
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
        hint: 'Ensure your DATABASE_URL is set in Vercel settings and trigger a Redeploy.'
      }));
    }
  }
}
