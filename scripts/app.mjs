// npm run app: the app in its own window on this PC (Chrome, else Edge), 1400 x 900 so it opens in the desktop layout
// (desktop-kit's README, "The standard: the Chrome app matches the desktop app"). pwa-kit/browser starts the browser
// with --app, never with a debugging flag.
//   APP_URL  the page to open (default http://127.0.0.1:<port>/, the dev server: run npm run dev first)
//   APP_ID   the installed app's id (chrome://apps, right click, App info): opens the installed app instead
import { openApp } from 'pwa-kit/browser';
import { APP } from '../app.config';

const appId = process.env.APP_ID?.trim() || undefined;
const url = process.env.APP_URL?.trim() || `http://127.0.0.1:${APP.port}/`;
const child = openApp({ ...(appId ? { appId } : { url }), width: 1400, height: 900 });
child.on('error', (err) => {
  console.error(`${APP.title}: no app window: ${err.message}`);
  process.exitCode = 1;
});
console.log(`${APP.title}: ${appId ? `the installed app ${appId}` : url} in an app window`);
