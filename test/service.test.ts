import { describe, expect, it } from 'vitest';
import { DAILY_AT, FIREBASE_KEY_FILE_VARIABLE, RESULTS_EVERY_MS, SOURCES, syncRoutes, syncRunner } from '../service/rawe-ceek-daily.mjs';
import { GEMINI_KEY_VARIABLE } from '../service/sync/ai.mjs';
import { memoryStore } from '../service/sync/firestore.mjs';
import type { DocStore } from '../service/sync/firestore.mjs';
import type { Source } from '../service/sync/source.mjs';
import { paths } from '../service/sync/sync.mjs';
import type { Round } from '../src/lib/raceData';

// The sync as the service runs it, over a store in memory and a fake source: the run lock, the status the page reads
// and the routes. No network, no key file, no kit: the runner is driven directly.

const NOW = new Date('2026-11-27T16:30:00Z');

const qatar: Round = {
  round: 22,
  name: 'Qatar Grand Prix',
  circuitName: 'Lusail International Circuit',
  city: 'Lusail',
  country: 'Qatar',
  countryCode: 'QA',
  timeZone: 'Asia/Qatar',
  circuitKey: 'losail',
  lat: null,
  long: null,
  startDate: '2026-11-27',
  endDate: '2026-11-29',
  status: 'scheduled',
  source: { name: 'fake', url: 'https://example.test/', fetchedAt: '' },
  sessions: [
    { id: 'r22-race', kind: 'race', name: 'Race', startUtc: '2026-11-29T16:00:00Z', endUtc: null, localDate: '2026-11-29', timeConfidence: 'confirmed', status: 'upcoming', resultsState: 'none' },
  ],
};

/** A source whose calendar waits for `release()` while `held`, so a test can look at the runner mid-run. */
function heldSource() {
  let release = () => {};
  let held = false;
  let active = 0;
  let maxActive = 0;
  const calls: number[] = [];
  const source: Source = {
    series: 'f1',
    name: 'fake f1',
    async calendar(season) {
      calls.push(season);
      active += 1;
      maxActive = Math.max(maxActive, active);
      if (held) await new Promise<void>((r) => (release = r));
      active -= 1;
      return season === 2026 ? [structuredClone(qatar)] : null;
    },
    results: async () => null,
    standings: async () => ({ drivers: null, teams: null }),
    resultsWindowMinutes: () => 180,
  };
  return {
    source,
    calls,
    hold: () => (held = true),
    release: () => {
      held = false;
      release();
    },
    maxActive: () => maxActive,
  };
}

const noNetwork = async (): Promise<never> => {
  throw new Error('no network in the unit tests');
};

function runner(o: { store?: () => DocStore | null; env?: NodeJS.ProcessEnv; source?: Source } = {}) {
  const store = memoryStore();
  const src = heldSource();
  const r = syncRunner({
    store: o.store ?? (() => store),
    get: noNetwork,
    now: () => NOW,
    repair: () => null,
    sources: [o.source ?? src.source],
    env: o.env ?? {},
  });
  return { r, store, src };
}

/** Calls the routes as the kit's server would, and gives the answer or `next`. */
function call(routes: ReturnType<typeof syncRoutes>, method: string, url: string) {
  return new Promise<{ status: number; body: unknown; next: boolean }>((resolve) => {
    let status = 0;
    const res = {
      writeHead(s: number) {
        status = s;
        return res;
      },
      end(text: string) {
        resolve({ status, body: JSON.parse(text), next: false });
      },
    };
    routes({ method, url } as never, res as never, () => resolve({ status: 0, body: undefined, next: true }));
  });
}

const tick = () => new Promise((r) => setTimeout(r, 0));
const signal = () => new AbortController().signal;

describe('syncRunner', () => {
  it('runs the daily sync into the store and records it', async () => {
    const { r, store } = runner();
    const record = await r.daily(signal());
    expect(record).toMatchObject({ kind: 'calendar', trigger: 'schedule', ok: true, errors: [] });
    expect(record!.written).toBeGreaterThan(0);
    expect(store.docs.has(paths.season('f1', 2026))).toBe(true);
    expect(store.docs.has(paths.meta())).toBe(true);
    const status = r.status();
    expect(status.running).toBeNull();
    expect(status.last).toEqual(record);
    expect(status.lastCalendar).toEqual(record);
  });

  it('says what to set when no key file is set, and writes nothing', async () => {
    const { r, store } = runner({ store: () => null });
    const record = await r.daily(signal());
    expect(record!.ok).toBe(false);
    expect(record!.written).toBe(0);
    expect(record!.errors).toEqual([{ series: null, at: NOW.toISOString(), what: 'setup', message: `${FIREBASE_KEY_FILE_VARIABLE} is not set on this PC: nothing is written` }]);
    expect(store.writes).toEqual([]);
  });

  it('asks for the store again at each run, so a key file set later is taken', async () => {
    const store = memoryStore();
    let ready = false;
    const { r } = runner({ store: () => (ready ? store : null) });
    expect((await r.daily(signal()))!.ok).toBe(false);
    ready = true;
    expect((await r.daily(signal()))!.ok).toBe(true);
    expect(store.docs.has(paths.meta())).toBe(true);
  });

  it('records a failed run as the run\'s own error, with paths taken out of the message', async () => {
    const failing: DocStore = {
      get: async () => {
        throw new Error('the key file could not be read: C:\\Users\\someone\\keys\\rawe.json');
      },
      set: async () => {},
    };
    const { r } = runner({ store: () => failing });
    const record = await r.daily(signal());
    expect(record!.ok).toBe(false);
    const own = record!.errors.find((e) => e.series === null)!;
    expect(own.what).toBe('daily run');
    expect(own.message).toContain('<path>');
    expect(own.message).not.toContain('someone');
  });

  it('runs one run at a time: a results run is skipped and fetch now refused while one is under way', async () => {
    const { r, src } = runner();
    src.hold();
    const daily = r.daily(signal());
    await tick();
    expect(r.status().running).toMatchObject({ kind: 'calendar', trigger: 'schedule' });
    expect(await r.results(signal())).toBeNull();
    expect(r.fetchNow(signal())).toBe(false);
    src.release();
    expect((await daily)!.ok).toBe(true);
    expect(r.status().running).toBeNull();
    const now = r.fetchNow(signal());
    expect(now).not.toBe(false);
    expect(await now).toMatchObject({ kind: 'calendar', trigger: 'fetch-now', ok: true });
  });

  it('makes a daily run wait for the run under way, never two at once', async () => {
    const { r, src } = runner();
    src.hold();
    const first = r.fetchNow(signal()) as Promise<unknown>;
    await tick();
    const second = r.daily(signal());
    await tick();
    src.release();
    await Promise.all([first, second]);
    expect(src.maxActive()).toBe(1);
    expect(src.calls).toEqual([2026, 2027, 2026, 2027]);
    expect(r.status().lastCalendar?.trigger).toBe('schedule');
  });

  it('does not count a results run that found nothing to do', async () => {
    const { r } = runner();
    await r.daily(signal());
    const before = r.status().last;
    expect(await r.results(signal())).toBeNull();
    expect(r.status().last).toBe(before);
  });

  it('gives an aborted run up without recording it', async () => {
    const { r } = runner();
    const c = new AbortController();
    c.abort();
    await expect(r.daily(c.signal)).rejects.toThrow();
    expect(r.status().last).toBeNull();
  });
});

describe('the status', () => {
  it('says whether the keys are set, never what they are or where', async () => {
    const keyFile = 'C:\\Users\\someone\\keys\\rawe-ceek-service.json';
    const fakeKey = 'fake-gemini-key-for-tests';
    const { r } = runner({ env: { [FIREBASE_KEY_FILE_VARIABLE]: keyFile, [GEMINI_KEY_VARIABLE]: fakeKey } });
    await r.daily(signal());
    const status = r.status();
    expect(status.keySet).toBe(true);
    expect(status.aiRepair).toBe(true);
    const text = JSON.stringify(status);
    expect(text).not.toContain('someone');
    expect(text).not.toContain('rawe-ceek-service.json');
    expect(text).not.toContain(fakeKey);
    expect(runner().r.status()).toMatchObject({ keySet: false, aiRepair: false });
  });

  it('gives the schedule and the series', () => {
    expect(runner().r.status()).toMatchObject({ schedule: { dailyAt: DAILY_AT, resultsEveryMinutes: RESULTS_EVERY_MS / 60_000 }, series: ['f1'] });
    expect(DAILY_AT).toBe('04:00');
    expect(RESULTS_EVERY_MS).toBe(5 * 60_000);
    expect(SOURCES.map((s) => s.series)).toEqual(['f1', 'f2', 'f3', 'f1academy', 'wec']);
  });
});

describe('syncRoutes', () => {
  it('answers GET /status and GET /last', async () => {
    const { r } = runner();
    const routes = syncRoutes(r, signal());
    expect(await call(routes, 'GET', '/last')).toEqual({ status: 200, body: null, next: false });
    await r.daily(signal());
    const status = await call(routes, 'GET', '/status?x=1');
    expect(status.status).toBe(200);
    expect(status.body).toMatchObject({ running: null, keySet: false, series: ['f1'] });
    expect(await call(routes, 'GET', '/last')).toEqual({ status: 200, body: { at: NOW.toISOString(), ok: true }, next: false });
  });

  it('starts a run on POST /fetch-now (202), and answers 409 while one is under way', async () => {
    const { r, src } = runner();
    const routes = syncRoutes(r, signal());
    src.hold();
    expect(await call(routes, 'POST', '/fetch-now')).toEqual({ status: 202, body: { started: true }, next: false });
    await tick();
    const busy = await call(routes, 'POST', '/fetch-now');
    expect(busy.status).toBe(409);
    expect(busy.body).toMatchObject({ started: false, running: { kind: 'calendar', trigger: 'fetch-now' } });
    src.release();
  });

  it('passes on what is not its own', async () => {
    const routes = syncRoutes(runner().r, signal());
    expect((await call(routes, 'GET', '/fetch-now')).next).toBe(true);
    expect((await call(routes, 'DELETE', '/status')).next).toBe(true);
    expect((await call(routes, 'GET', '/other')).next).toBe(true);
  });
});
