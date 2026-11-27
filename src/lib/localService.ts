import { APP, SERVICE_URL } from '../../app.config';

// desktop-kit's local service (desktop-kit/service) on this PC: what Chrome cannot do (a scraper, a job at four in the
// morning, a key that must stay on the PC) runs there, in the app's service/ modules. The page asks it over
// http://127.0.0.1:47380; on a phone, or on a PC without it, the fetch fails and the app goes on without it.

export interface ServiceHealth {
  machine: { id: string; name: string };
  services: { name: string; app: string; kind: 'leased' | 'local'; state: string }[];
  app?: { name: string; holdsLease: boolean; holder: { id: string; name: string } | null };
}

/** The service's health for this app, or null when it does not answer (not installed, stopped, Chrome's prompt refused). */
export async function serviceHealth(fetcher: typeof fetch = fetch, timeoutMs = 1500): Promise<ServiceHealth | null> {
  try {
    const r = await fetcher(`${SERVICE_URL}/health?app=${encodeURIComponent(APP.name)}`, { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return (await r.json()) as ServiceHealth;
  } catch {
    return null;
  }
}

/** This app's own services in the health answer. */
export const ownServices = (health: ServiceHealth) => health.services.filter((s) => s.app === APP.name);

/** A route of one of this app's services: /services/<name>/<path>. */
export function serviceRoute(service: string, path: string): string {
  return `${SERVICE_URL}/services/${encodeURIComponent(service)}/${path.replace(/^\/+/, '')}`;
}
