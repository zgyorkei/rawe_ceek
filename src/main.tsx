import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router';
import { install } from 'pwa-kit/install';
import { registerServiceWorker, shouldRegister } from 'pwa-kit/update';
import App from './App';
import './styles.css';

// Chrome's install event fires once, often before the page that offers the install is open: kept from the start.
install.listen(window);

// The service worker (pwa-kit/sw, src/sw.ts): the production build only, registered once the page has loaded. It keeps
// the app working offline and waits for the page's Reload before a new version takes over.
if (shouldRegister({ prod: import.meta.env.PROD, mode: import.meta.env.MODE, supported: 'serviceWorker' in navigator, desktopWindow: false })) {
  window.addEventListener('load', () => {
    registerServiceWorker(navigator.serviceWorker).catch((err) => console.warn('the service worker was not registered', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
