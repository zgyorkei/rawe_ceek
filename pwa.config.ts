// The app's PWA, stated once for pwa-kit: the manifest, the head tags and the worker all come from this.
import { definePwa } from 'pwa-kit';
import { APP } from './app.config';

export default definePwa({
  app: APP.name,
  name: APP.title,
  shortName: APP.title,
  description: `${APP.title}, on the phone and as an app window on the PC.`,
  lang: 'en',
  themeColor: '#1f2a24',
  backgroundColor: '#f4f1ea',
  // Vector icons (public/icon.svg), stated at the two sizes browsers ask for before they offer the install (one SVG
  // serves both). iPhone and iPad want a PNG for the home screen: render one from the SVG and name it in
  // appleTouchIcon when the app is to be added there.
  icons: [
    { src: '/icon.svg', size: 192, purpose: 'any', type: 'image/svg+xml' },
    { src: '/icon.svg', size: 512, purpose: 'any', type: 'image/svg+xml' },
    { src: '/icon-maskable.svg', size: 512, purpose: 'maskable', type: 'image/svg+xml' },
  ],
  // The installed app's right-click list (the taskbar, the Start menu). Each url is a route of src/lib/nav.ts.
  quickActions: [
    { name: 'Series', shortName: 'Series', description: 'The series and their calendars', url: '/series', icon: '/icon-series.svg' },
  ],
  // A launch into the open window moves it (src/lib/launch.ts) instead of opening a second one.
  launchHandler: ['navigate-existing', 'auto'],
});
