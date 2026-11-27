import { navStore, type NavDestination } from 'pwa-kit/nav';

// The main navigation (pwa-kit/nav): a bar at the foot under 600 px (the phone), a rail from 600, and from 1200 px the
// desktop layout. On a PC the app window opens at 1400 x 900 (npm run app), so the Chrome app looks like a desktop
// app (desktop-kit's README, "The standard: the Chrome app matches the desktop app").

export const DESTINATIONS: readonly NavDestination[] = [
  { id: 'home', label: 'Home', route: '/' },
  { id: 'series', label: 'Series', route: '/series' },
  { id: 'pc', label: 'This PC', route: '/pc' },
];

export const NAV_CONFIG = { destinations: DESTINATIONS, wide: 'rail-expanded' } as const;

export const nav = typeof window !== 'undefined' ? navStore(NAV_CONFIG, window) : null;
