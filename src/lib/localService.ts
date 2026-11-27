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

/** The data sync's service (service/rawe-ceek-daily.mjs): a leased service, so it answers only on the PC that holds the lease. */
export const SYNC_SERVICE = 'rawe-ceek-daily';

/** One error of a sync run: a source's (its series named) or the run's own (no key file, Firestore unreachable). */
export interface SyncRunError {
  series: string | null;
  at: string;
  what: string;
  message: string;
}

/** How one sync run ended. */
export interface SyncRun {
  kind: 'calendar' | 'results';
  trigger: 'schedule' | 'fetch-now';
  startedAt: string;
  endedAt: string;
  ok: boolean;
  written: number;
  errors: SyncRunError[];
}

/** The sync's status as GET /services/rawe-ceek-daily/status answers it: never a key, only whether each is set. */
export interface SyncStatus {
  running: { kind: 'calendar' | 'results'; trigger: 'schedule' | 'fetch-now'; startedAt: string } | null;
  last: SyncRun | null;
  lastCalendar: SyncRun | null;
  keySet: boolean;
  aiRepair: boolean;
  schedule: { dailyAt: string; resultsEveryMinutes: number };
  series: string[];
}

/** The sync's status on this PC, or null when the sync does not answer here (not on, or another PC holds the lease). */
export async function syncStatus(fetcher: typeof fetch = fetch, timeoutMs = 1500): Promise<SyncStatus | null> {
  try {
    const r = await fetcher(serviceRoute(SYNC_SERVICE, 'status'), { signal: AbortSignal.timeout(timeoutMs) });
    if (!r.ok) return null;
    return (await r.json()) as SyncStatus;
  } catch {
    return null;
  }
}

/** What "Fetch now" got: started, already running, or no answer (the sync is not on this PC). */
export type FetchNowResult = 'started' | 'running' | 'unreachable';

/** Asks the sync on this PC to run the daily sync now (the calendars, past results and the standings). */
export async function fetchNow(fetcher: typeof fetch = fetch, timeoutMs = 5000): Promise<FetchNowResult> {
  try {
    const r = await fetcher(serviceRoute(SYNC_SERVICE, 'fetch-now'), { method: 'POST', signal: AbortSignal.timeout(timeoutMs) });
    if (r.status === 202) return 'started';
    if (r.status === 409) return 'running';
    return 'unreachable';
  } catch {
    return 'unreachable';
  }
}
