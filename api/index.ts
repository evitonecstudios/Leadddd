import type { IncomingMessage, ServerResponse } from 'http';
import { app } from '../server.ts';

export default function handler(req: IncomingMessage, res: ServerResponse) {
  // If Vercel rewrites stripped the /api prefix, ensure /api is prepended so Express routes match
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? req.url : '/' + req.url);
  }
  return (app as any)(req, res);
}
