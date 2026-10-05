import type { IncomingMessage, ServerResponse } from 'http';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // Lazy import to catch top-level evaluation errors in server.ts
    const { app } = await import('../server.ts');

    if (!app) {
      throw new Error('Express app failed to initialize correctly.');
    }

    // Ensure URL has /api prefix for internal Express routing if Vercel stripped it
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    
    // Explicitly handle health check early
    if (req.url === '/api/health') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ status: 'ok', environment: process.env.NODE_ENV, platform: 'vercel' }));
      return;
    }

    return (app as any)(req, res);
  } catch (error: any) {
    console.error('[VERCEL-HANDLER] FATAL ERROR:', error);
    
    // Attempt to return a clean JSON error response even on crash
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Function Invocation Error',
      message: error.message,
      code: error.code || 'HANDLER_CRASH',
      hint: 'This usually indicates a database connection failure or missing environment variables on Vercel.',
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
}


