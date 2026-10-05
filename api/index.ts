import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    console.log(`[VERCEL-HANDLER] Handling request: ${req.method} ${req.url}`);
    
    // Use explicit extension to help Vercel's bundler resolve the module correctly in ESM mode
    const { app } = await import('../server.ts');

    if (!app) {
      throw new Error('Express app failed to initialize correctly (app is undefined).');
    }

    // Ensure URL has /api prefix for internal Express routing if Vercel stripped it
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    
    // Explicitly handle health check early with maximum diagnostic detail
    if (req.url === '/api/health' || req.url === '/api/debug/db') {
      console.log('[VERCEL-HANDLER] Routing to internal health check...');
      return (app as any)(req, res);
    }

    return (app as any)(req, res);
  } catch (error: any) {
    console.error('[VERCEL-HANDLER] FATAL ERROR:', error);
    
    // Diagnostic: Log current directory contents to see what's actually there
    try {
      const { readdirSync } = await import('fs');
      console.log('[VERCEL-HANDLER] Directory contents at root:', readdirSync('.'));
      console.log('[VERCEL-HANDLER] Directory contents at /var/task:', readdirSync('/var/task'));
    } catch (fsError) {
      console.error('[VERCEL-HANDLER] Failed to read directory:', fsError);
    }
    
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Function Invocation Error',
      message: error.message,
      code: error.code || 'HANDLER_CRASH',
      env: {
        has_db_url: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
        has_firebase_id: Boolean(process.env.FIREBASE_PROJECT_ID),
        node_env: process.env.NODE_ENV
      },
      hint: 'Check if you applied the Supabase schema and if the DATABASE_URL is correctly set in Vercel.',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
}


