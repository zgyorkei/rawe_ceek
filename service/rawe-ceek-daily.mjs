// A leased service of desktop-kit's local service (desktop-kit/service): the data sync (RW.DATA, RW.RESEARCH 1.1 and
// 6.2). It runs on the one machine holding the app's lease (the mini PC, else the user's PC), so the sources are read
// once however many PCs have it on. Added once on each machine (README, "The local service"); off until it is
// switched on there. The top level only defines: the module is imported only while the switch has it on.
//
// The schedule: the calendars, a backfill of past results and the standings at 04:00 every day; the results every
// five minutes while a session's results are due (sync.mjs resultsDue). One run at a time: a results run that finds
// another run under way is skipped, the daily run and a "fetch now" wait for it.

import { defineService, publicMessage } from 'desktop-kit/service';
import { GEMINI_KEY_VARIABLE, geminiRepair } from './sync/ai.mjs';
import { FIREBASE_KEY_FILE_VARIABLE, writerFromEnv } from './sync/firestore.mjs';
import { politeGet } from './sync/http.mjs';
import { source as f1 } from './sync/sources/f1.mjs';
import { source as f1academy } from './sync/sources/f1academy.mjs';
import { f2Source, f3Source } from './sync/sources/fia.mjs';
import { source as wec } from './sync/sources/wec.mjs';
import { dailySync, syncResults, writeMeta } from './sync/sync.mjs';

/** @typedef {import('./sync/firestore.mjs').DocStore} DocStore */
/** @typedef {import('./sync/source.mjs').Source} Source */
/** @typedef {import('./sync/source.mjs').Repair} Repair */
/** @typedef {import('./sync/http.mjs').Get} Get */
/** @typedef {import('./sync/sync.mjs').SyncReport} SyncReport */
/** @typedef {import('./sync/sync.mjs').SyncError} SyncError */
/** A run's error: a source's (its series named) or the run's own (series null: no key file, Firestore unreachable). @typedef {Omit<SyncError, 'series'> & { series: SyncError['series'] | null }} RunError */

export { FIREBASE_KEY_FILE_VARIABLE };

/** The key file's path, or null when the variable is not set. The file itself is read only where the service signs in. */
export const firebaseKeyFile = (env = process.env) => env[FIREBASE_KEY_FILE_VARIABLE]?.trim() || null;

/** The sources the sync reads, one per series (RW.RESEARCH 1.1). Formula E is in the model but has no fetcher yet (RW.DATA.FE). */
export const SOURCES = /** @type {Source[]} */ ([f1, f2Source, f3Source, f1academy, wec]);

/** When the daily run starts (local time of the machine that holds the lease). */
export const DAILY_AT = '04:00';
/** How often the results run looks for a session whose results are due. */
export const RESULTS_EVERY_MS = 5 * 60_000;

/**
 * How one run ended, as the page shows it: when, which run, how many documents it wrote, what failed.
 * @typedef {{ kind: 'calendar' | 'results', trigger: 'schedule' | 'fetch-now', startedAt: string, endedAt: string, ok: boolean, written: number, errors: RunError[] }} RunRecord
 */

/**
 * What GET /status answers: never a key, a key file's path or a key's content; only whether each is set.
 * @typedef {object} SyncStatus
 * @property {{ kind: 'calendar' | 'results', trigger: 'schedule' | 'fetch-now', startedAt: string } | null} running
 * @property {RunRecord | null} last The last run that ended (a results run that found nothing due is not counted).
 * @property {RunRecord | null} lastCalendar The last daily run (or fetch now) that ended.
 * @property {boolean} keySet Whether RAWE_CEEK_FIREBASE_KEY_FILE is set on this PC.
 * @property {boolean} aiRepair Whether the WEC's AI repair is on (RAWE_CEEK_GEMINI_API_KEY set on this PC).
 * @property {{ dailyAt: string, resultsEveryMinutes: number }} schedule
 * @property {string[]} series The series this PC's sync reads.
 */

/**
 * The sync as the service runs it, apart from the kit, so the tests can drive it: the run lock, the results' try
 * times kept between runs, and the status the routes answer.
 * @param {{ store: () => DocStore | null, get: Get, now?: () => Date, repair?: () => Repair | null, sources?: Source[],
 *   log?: { info(m: string): void, warn(m: string): void }, env?: NodeJS.ProcessEnv }} o
 *   `store`: the writer, or null when no key file is set (it is asked again at each run until it gives one).
 */
export function syncRunner(o) {
  const now = o.now ?? (() => new Date());
  const sources = o.sources ?? SOURCES;
  const env = o.env ?? process.env;
  /** @type {Map<string, number>} */
  const lastTry = new Map();
  /** @type {SyncStatus['running']} */
  let running = null;
  /** @type {RunRecord | null} */
  let last = null;
  /** @type {RunRecord | null} */
  let lastCalendar = null;
  /** @type {Promise<unknown>} */
  let chain = Promise.resolve();

  /**
   * One run under the lock.
   * @param {'calendar' | 'results'} kind @param {'schedule' | 'fetch-now'} trigger @param {AbortSignal} signal
   * @returns {Promise<RunRecord | null>} null when the results run found nothing to do
   */
  const run = (kind, trigger, signal) => {
    const job = async () => {
      signal.throwIfAborted();
      const startedAt = now().toISOString();
      running = { kind, trigger, startedAt };
      /** @type {SyncReport[]} */
      let reports = [];
      /** @type {RunError[]} */
      const failures = [];
      try {
        const store = o.store();
        if (!store) {
          failures.push({ series: null, at: startedAt, what: 'setup', message: `${FIREBASE_KEY_FILE_VARIABLE} is not set on this PC: nothing is written` });
        } else {
          const repair = o.repair?.() ?? undefined;
          const deps = { store, sources, get: o.get, now, signal, log: o.log, ...(repair ? { repair } : {}) };
          reports = kind === 'calendar' ? await dailySync(deps, { lastTry }) : [await syncResults(deps, { lastTry })];
          await writeMeta(deps, reports);
        }
      } catch (e) {
        if (signal.aborted) throw e;
        failures.push({ series: null, at: startedAt, what: kind === 'calendar' ? 'daily run' : 'results run', message: publicMessage(e) });
        o.log?.warn(`the ${kind} run failed: ${publicMessage(e)}`);
      } finally {
        running = null;
      }
      const errors = [...reports.flatMap((r) => r.errors), ...failures].map((e) => ({ ...e, message: publicMessage(e.message) }));
      const written = reports.reduce((n, r) => n + r.written.length, 0);
      if (kind === 'results' && written === 0 && errors.length === 0) return null;
      /** @type {RunRecord} */
      const record = { kind, trigger, startedAt, endedAt: now().toISOString(), ok: failures.length === 0, written, errors };
      last = record;
      if (kind === 'calendar') lastCalendar = record;
      o.log?.info(`the ${kind} run wrote ${written} document(s)${errors.length ? `, ${errors.length} error(s)` : ''}`);
      return record;
    };
    const p = chain.then(job, job);
    chain = p.catch(() => undefined);
    return p;
  };

  return {
    /** The daily run (the calendars, the backfill, the standings); waits for a run under way. @param {AbortSignal} signal */
    daily: (signal) => run('calendar', 'schedule', signal),
    /** The results run; skipped (null) while another run is under way. @param {AbortSignal} signal */
    results: (signal) => (running ? Promise.resolve(null) : run('results', 'schedule', signal)),
    /**
     * The page's "Fetch now": a daily run started at once, or false while a run is under way.
     * @param {AbortSignal} signal @returns {false | Promise<RunRecord | null>}
     */
    fetchNow: (signal) => (running ? false : run('calendar', 'fetch-now', signal)),
    /** @returns {SyncStatus} */
    status: () => ({
      running,
      last,
      lastCalendar,
      keySet: firebaseKeyFile(env) !== null,
      aiRepair: Boolean(env[GEMINI_KEY_VARIABLE]?.trim()),
      schedule: { dailyAt: DAILY_AT, resultsEveryMinutes: RESULTS_EVERY_MS / 60_000 },
      series: sources.map((s) => s.series),
    }),
  };
}

/**
 * The service's routes, mounted at /services/rawe-ceek-daily/ (the kit checks the origin and answers CORS):
 *   GET  /status     the sync's status (SyncStatus)
 *   POST /fetch-now  202 when a run started, 409 while one is under way
 *   GET  /last       the last run's time and outcome, or null
 * @param {ReturnType<typeof syncRunner>} runner @param {AbortSignal} signal
 * @returns {NonNullable<import('desktop-kit/service').RunningService['http']>}
 */
export function syncRoutes(runner, signal) {
  return (req, res, next) => {
    const send = (/** @type {number} */ status, /** @type {unknown} */ body) => {
      res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(body));
    };
    const path = (req.url ?? '').split('?')[0];
    if (req.method === 'GET' && path === '/status') return send(200, runner.status());
    if (req.method === 'GET' && path === '/last') {
      const { last } = runner.status();
      return send(200, last ? { at: last.endedAt, ok: last.ok } : null);
    }
    if (req.method === 'POST' && path === '/fetch-now') {
      const started = runner.fetchNow(signal);
      if (!started) return send(409, { started: false, running: runner.status().running });
      started.catch(() => undefined);
      return send(202, { started: true });
    }
    return next();
  };
}

export default defineService({
  name: 'rawe-ceek-daily',
  app: 'rawe-ceek',
  kind: 'leased',
  description: 'the data sync of Rawe Ceek: calendars, results and standings into Firestore',
  start(ctx) {
    if (!firebaseKeyFile()) ctx.log.warn(`${FIREBASE_KEY_FILE_VARIABLE} is not set: the sync cannot write to Firestore`);
    /** @type {DocStore | null} */
    let store = null;
    const runner = syncRunner({
      // made at the first run that needs it, and again after a failure (a key file fixed or set later)
      store: () => (store ??= writerFromEnv(process.env, { signal: ctx.signal })),
      get: politeGet({ signal: ctx.signal }),
      repair: () => geminiRepair({ signal: ctx.signal }),
      log: ctx.log,
    });
    ctx.daily(DAILY_AT, async (signal) => {
      const record = await runner.daily(signal);
      // a daily run that could not start its work fails, so the lease lets the next machine try it once more
      if (record && !record.ok) throw new Error(record.errors.map((e) => e.message).join('; '));
    }, { name: 'calendar' });
    ctx.every(RESULTS_EVERY_MS, (signal) => runner.results(signal), { name: 'results' });
    return { http: syncRoutes(runner, ctx.signal) };
  },
});
