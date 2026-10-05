import express from 'express';
import { createServerApp } from './src/app.ts';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = createServerApp();

async function startServer() {
  if (process.env.NODE_ENV === 'development') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'custom' });
    app.use(vite.middlewares);
    app.use('*', async (req, res, next) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
      }
      const url = req.originalUrl;
      try {
        const template = fs.readFileSync(path.resolve(__dirname, 'index.html'), 'utf-8');
        let html = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(html);
      } catch (e: any) {
        console.error('Vite Transformation Error:', e);
        vite.ssrFixStacktrace(e as Error);
        res.status(500).end(`
          <div style="padding: 20px; font-family: sans-serif;">
            <h1 style="color: #dc2626;">Internal Server Error (Vite)</h1>
            <p>Failed to transform HTML for the requested route.</p>
            <pre style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-size: 12px;">${e.message}</pre>
          </div>
        `);
      }
    });
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (req, res) => {
      if (req.originalUrl.startsWith('/api')) {
        return res.status(404).json({ success: false, error: 'API endpoint not found' });
      }
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  const port = process.env.NODE_ENV === 'production' && process.env.PORT ? Number(process.env.PORT) : 3000;
  app.listen(port, '0.0.0.0', () => {
    console.log(`\n---------------------------------------------------`);
    console.log(`🚀 LEADFORGE BACKEND READY`);
    console.log(`📡 Listening on: http://0.0.0.0:${port}`);
    console.log(`🔧 Mode: ${process.env.NODE_ENV || 'development'}`);
    console.log(`---------------------------------------------------\n`);
  });
}

const isMainModule = process.argv[1] && (process.argv[1].endsWith('server.ts') || process.argv[1].endsWith('server.js'));

if (isMainModule && !process.env.VERCEL) {
  startServer();
}

export { app };
