/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { pwa } from 'pwa-kit/vite';
import { APP } from './app.config';
import pwaConfig from './pwa.config';

// Only VITE_ variables reach the page (the Firebase web config, which is public). A server key (EXAMPLE_API_KEY and
// the like) is read at run time by api/ on Vercel and by server.ts here, never defined into the page.
export default defineConfig({
  plugins: [
    react(),
    // the manifest, the head tags and dist/sw.js from pwa-kit (pwa.config.ts, src/sw.ts)
    pwa({ config: pwaConfig, worker: path.resolve(import.meta.dirname, 'src/sw.ts') }) as unknown as Plugin,
  ],
  // the app's fixed origin on this PC: http://127.0.0.1:<port>, never another port
  server: { host: '127.0.0.1', port: APP.port, strictPort: true },
  preview: { host: '127.0.0.1', port: APP.port, strictPort: true },
  test: {
    include: ['test/**/*.test.ts'],
  },
});
