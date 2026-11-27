// The service worker, from pwa-kit: built into dist/sw.js by pwa-kit's Vite plugin (vite.config.ts) with the build's
// file list and version. It precaches the shell, answers navigations network first (the cached page offline) and
// waits for the page's Reload before a new version takes over.
import { startServiceWorker } from 'pwa-kit/sw';
import pwa from '../pwa.config';

startServiceWorker(pwa);
