import dotenv from 'dotenv';
import express from 'express';
import { createServer } from 'node:http';
import { createServer as createViteServer } from 'vite';
import { APP } from './app.config';
import { registerApiRoutes } from './lib/api';

// npm run dev: the API routes and the page from Vite, on http://127.0.0.1:<port> only (the hot reload on the same
// port). The keys come from .env (never committed), read at run time like Vercel's settings on the site.
dotenv.config({ quiet: true });

const app = express();
app.disable('x-powered-by');
registerApiRoutes(app);
const server = createServer(app);
const vite = await createViteServer({ server: { middlewareMode: true, hmr: { server } }, appType: 'spa' });
app.use(vite.middlewares);

server.on('error', (err: NodeJS.ErrnoException) => {
  // the port is the app's own (the registry in desktop-kit's README): never another one
  console.error(err.code === 'EADDRINUSE' ? `port ${APP.port} is in use: is ${APP.title} already running?` : err.message);
  process.exit(1);
});
server.listen(APP.port, '127.0.0.1', () => {
  console.log(`${APP.title}: http://127.0.0.1:${APP.port}/`);
});
