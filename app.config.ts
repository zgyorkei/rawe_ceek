// The app's names and its port, stated once. `desktop-kit create` filled them in; the port is the app's row in the
// port registry (desktop-kit's README, "Ports"), so two apps never share one.

export const APP = {
  /** The app's id: lower case letters, digits and hyphens. The PWA's id, the local service's app, the services' prefix. */
  name: 'rawe-ceek',
  /** The name a person sees. */
  title: 'Rawe Ceek',
  /**
   * The dev and preview server's port on 127.0.0.1 (strict: taken means an error, never another port). A page from
   * http://127.0.0.1:<port> is always answered by the local service, so this origin needs no `origins add`.
   */
  port: 47341,
} as const;

/** desktop-kit's local service (desktop-kit/service), the same port on every PC. */
export const SERVICE_URL = 'http://127.0.0.1:47380';
