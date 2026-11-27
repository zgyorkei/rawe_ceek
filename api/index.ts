import express from 'express';
import { registerApiRoutes } from '../lib/api.js';

// Vercel's serverless entry: every /api/* request comes here (vercel.json). The routes are shared with server.ts.
const app = express();
app.disable('x-powered-by');
registerApiRoutes(app);

export default app;
