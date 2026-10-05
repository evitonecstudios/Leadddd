import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../server.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    // If Vercel rewrites stripped the /api prefix, ensure /api is prepended so Express routes match
    if (req.url && !req.url.startsWith('/api')) {
      req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
    }
    return (app as any)(req, res);
  } catch (error: any) {
    console.error('[VERCEL-HANDLER] Critical execution error:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ 
      success: false, 
      error: 'Internal Server Error',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }));
  }
}

