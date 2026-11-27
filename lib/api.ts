import type { Express, Request, Response } from 'express';
import express from 'express';

// The app's server routes, the same on Vercel (api/index.ts) and on this PC (server.ts). A key the routes need is
// read from the environment at run time, each time it is used: Vercel's project settings on the site, .env here. It
// is never a VITE_ variable, never in src/ and never in the page.

/** A server key by its name, or null when it is not set. */
export function serverKey(name: string, env: NodeJS.ProcessEnv = process.env): string | null {
  const value = env[name]?.trim();
  return value ? value : null;
}

export function registerApiRoutes(app: Express, env: NodeJS.ProcessEnv = process.env): void {
  app.use('/api', express.json({ limit: '1mb' }));

  // GET /api/health: the API answers; it names no key and no setting.
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  // POST /api/example: the shape of a route that calls an outside service with a server key.
  app.post('/api/example', (req: Request, res: Response) => {
    const key = serverKey('EXAMPLE_API_KEY', env);
    if (!key) {
      res.status(503).json({ error: 'EXAMPLE_API_KEY is not set where the API runs' });
      return;
    }
    const text = typeof req.body?.text === 'string' ? req.body.text : '';
    // call the outside service here with `key`; never send the key back or log it
    res.json({ length: text.length });
  });

  app.use('/api', (_req: Request, res: Response) => {
    res.status(404).json({ error: 'no such route' });
  });
}
