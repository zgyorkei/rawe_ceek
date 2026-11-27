import { describe, expect, it } from 'vitest';
import { memoryStore } from '../service/sync/firestore.mjs';
import type { Source } from '../service/sync/source.mjs';
import {
  LATE_HOURS,
  SERIES_NAMES,
  carryOver,
  contentHash,
  currentSeason,
  dailySync,
  markShared,
  paths,
  resultsDue,
  seasonsAround,
  syncCalendar,
  syncResults,
  writeMeta,
} from '../service/sync/sync.mjs';
import * as raceData from '../src/lib/raceData';
import type { ResultDoc, Round, SeasonDoc, SeriesId, Session, SessionKind, StandingsDoc, SyncMeta } from '../src/lib/raceData';

// The sync over a store in memory and fake sources: what it writes, when, and what it leaves. No network: the getter
// throws if anything asks it.

/** Friday of the Qatar weekend, after practice 1. */
const NOW = new Date('2026-11-27T16:30:00Z');

function session(id: string, kind: SessionKind, startUtc: string, endUtc: string | null): Session {
  return { id, kind, name: id, startUtc, endUtc, localDate: startUtc.slice(0, 10), timeConfidence: 'confirmed', status: 'upcoming', resultsState: 'none' };
}

function round(n: number, circuitKey: string, startDate: string, endDate: string, sessions: Session[]): Round {
  return {
    round: n,
    name: `Round ${n}`,
    circuitName: circuitKey,
    city: circuitKey,
    country: 'Somewhere',
    countryCode: 'QA',
    timeZone: 'UTC',
    circuitKey,
    lat: null,
    long: null,
    startDate,
    endDate,
    status: 'scheduled',
    source: { name: 'fake', url: 'https://example.test/', fetchedAt: '' },
    sessions,
  };
}

/** Las Vegas (past) and Qatar (this weekend), as a source gives them. */
const season2026 = () => [
  round(21, 'vegas', '2026-11-20', '2026-11-22', [session('r21-race', 'race', '2026-11-22T04:00:00Z', '2026-11-22T06:00:00Z')]),
  round(22, 'losail', '2026-11-27', '2026-11-29', [
    session('r22-fp1', 'practice', '2026-11-27T13:30:00Z', '2026-11-27T14:30:00Z'),
    session('r22-race', 'race', '2026-11-29T16:00:00Z', '2026-11-29T18:00:00Z'),
  ]),
];

const rows = (winner: string) => [
  { position: 1, driverName: winner, team: 'Team A', timeOrGap: '1:30:00.000', points: 25 },
  { position: 2, driverName: 'Second Driver', team: 'Team B', timeOrGap: '+1.000', points: 18 },
];

const table = (kind: 'drivers' | 'teams', afterRound: number, points: number): StandingsDoc => ({
  kind,
  afterRound,
  rows: [{ position: 1, name: kind === 'drivers' ? 'First Driver' : 'Team A', points }],
});

interface FakeOptions {
  rounds?: Partial<Record<number, Round[]>>;
  results?: (round: Round, session: Session) => ResultDoc | null;
  standings?: (season: number) => { drivers: StandingsDoc | null; teams: StandingsDoc | null };
  failCalendar?: string;
}

/** A source over fixed rounds; each calendar call stamps a new fetch time, as a real fetch does. */
function fakeSource(series: SeriesId, o: FakeOptions = {}) {
  const calls = { calendar: [] as number[], results: [] as string[], standings: [] as number[] };
  let fetches = 0;
  const source: Source = {
    series,
    name: `fake ${series}`,
    async calendar(season) {
      calls.calendar.push(season);
      if (o.failCalendar) throw new Error(o.failCalendar);
      const rounds = o.rounds?.[season];
      if (!rounds) return null;
      fetches += 1;
      return structuredClone(rounds).map((r) => ({ ...r, source: { ...r.source, fetchedAt: `fetch ${fetches}` } }));
    },
    async results(season, r, s) {
      calls.results.push(`${season}/${s.id}`);
      return o.results?.(r, s) ?? null;
    },
    async standings(season) {
      calls.standings.push(season);
      return o.standings?.(season) ?? { drivers: null, teams: null };
    },
    resultsWindowMinutes: () => 180,
  };
  return { source, calls };
}

function setup(sources: Source[], at: Date = NOW) {
  const store = memoryStore();
  let now = at;
  const deps = {
    store,
    sources,
    get: async (): Promise<never> => {
      throw new Error('no network in the unit tests');
    },
    now: () => now,
  };
  return { store, deps, setNow: (d: Date) => (now = d) };
}

const seasonDoc = (store: ReturnType<typeof memoryStore>, series: SeriesId, y: number) => store.docs.get(paths.season(series, y)) as unknown as SeasonDoc;
const sessionIn = (doc: SeasonDoc, id: string) => doc.rounds.flatMap((r) => r.sessions).find((s) => s.id === id)!;

describe('the model the sync writes', () => {
  it('has the paths and series names of raceData.ts', () => {
    expect(SERIES_NAMES).toEqual(raceData.SERIES_NAMES);
    expect(Object.keys(SERIES_NAMES)).toEqual([...raceData.SERIES_IDS]);
    for (const s of raceData.SERIES_IDS) {
      expect(paths.seriesDoc(s)).toBe(raceData.seriesDocPath(s));
      expect(paths.season(s, 2026)).toBe(raceData.seasonPath(s, 2026));
      expect(paths.result(s, 2026, 'r1-race')).toBe(raceData.resultPath(s, 2026, 'r1-race'));
      expect(paths.standings(s, 2026, 'drivers')).toBe(raceData.standingsPath(s, 2026, 'drivers'));
    }
    expect(paths.meta()).toBe(raceData.syncMetaPath());
  });

  it('looks at this season and the next, and last season in January', () => {
    expect(seasonsAround(NOW)).toEqual([2026, 2027]);
    expect(seasonsAround(new Date('2027-01-10T00:00:00Z'))).toEqual([2026, 2027, 2028]);
  });

  it('hashes the rounds without their fetch times', () => {
    const a = season2026();
    const b = season2026().map((r) => ({ ...r, source: { ...r.source, fetchedAt: 'later' } }));
    expect(contentHash(a)).toBe(contentHash(b));
    b[1].sessions[1].startUtc = '2026-11-29T17:00:00Z';
    expect(contentHash(a)).not.toBe(contentHash(b));
  });
});

describe('syncCalendar', () => {
  it('writes a season only when its content changed, and the series document once', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const { store, deps } = setup([f1.source]);
    const first = await syncCalendar(deps);
    expect(first.errors).toEqual([]);
    expect(first.written).toEqual([paths.season('f1', 2026), paths.seriesDoc('f1')]);
    expect(store.docs.get(paths.seriesDoc('f1'))).toEqual({ name: 'Formula 1', currentSeason: 2026 });
    expect(f1.calls.calendar).toEqual([2026, 2027]);

    // the same calendar fetched again (a new fetch time only): nothing written
    const second = await syncCalendar(deps);
    expect(second.written).toEqual([]);

    // a session moved: the season is written again
    const moved = season2026();
    moved[1].sessions[1].startUtc = '2026-11-29T17:00:00Z';
    const f1b = fakeSource('f1', { rounds: { 2026: moved } });
    const third = await syncCalendar({ ...deps, sources: [f1b.source] });
    expect(third.written).toEqual([paths.season('f1', 2026)]);
    expect(sessionIn(seasonDoc(store, 'f1', 2026), 'r22-race').startUtc).toBe('2026-11-29T17:00:00Z');
  });

  it('carries the stored results states over a fresh calendar', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const { store, deps } = setup([f1.source]);
    await syncCalendar(deps);
    const doc = seasonDoc(store, 'f1', 2026);
    sessionIn(doc, 'r21-race').resultsState = 'final';
    await store.set(paths.season('f1', 2026), doc as never);
    await syncCalendar(deps);
    expect(sessionIn(seasonDoc(store, 'f1', 2026), 'r21-race').resultsState).toBe('final');
    expect(sessionIn(seasonDoc(store, 'f1', 2026), 'r22-race').resultsState).toBe('none');
  });

  it('carryOver keeps each session state by id and gives a new session none', () => {
    const old: SeasonDoc = { series: 'f1', season: 2026, rounds: season2026() };
    old.rounds[0].sessions[0].resultsState = 'final';
    const fresh = season2026();
    fresh[1].sessions.push(session('r22-qualifying', 'qualifying', '2026-11-28T17:00:00Z', null));
    delete (fresh[1].sessions[2] as Partial<Session>).resultsState;
    carryOver(fresh, old);
    expect(fresh.flatMap((r) => r.sessions.map((s) => [s.id, s.resultsState]))).toEqual([
      ['r21-race', 'final'],
      ['r22-fp1', 'none'],
      ['r22-race', 'none'],
      ['r22-qualifying', 'none'],
    ]);
  });

  it('marks the weekends two series share: the same circuit and overlapping dates', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const f2 = fakeSource('f2', {
      rounds: {
        2026: [
          round(13, 'vegas', '2026-11-13', '2026-11-15', [session('r13-race', 'race', '2026-11-15T10:00:00Z', null)]),
          // F2 starts a day before F1 and ends with it: overlap, not equal dates
          round(14, 'losail', '2026-11-26', '2026-11-29', [session('r14-feature', 'race', '2026-11-29T11:00:00Z', null)]),
        ],
      },
    });
    const { store, deps } = setup([f1.source, f2.source]);
    await syncCalendar(deps);
    const f1Doc = seasonDoc(store, 'f1', 2026);
    const f2Doc = seasonDoc(store, 'f2', 2026);
    expect(f1Doc.rounds[1].sharedWith).toEqual([{ series: 'f2', round: 14 }]);
    expect(f1Doc.rounds[0].sharedWith).toBeUndefined();
    expect(f2Doc.rounds[1].sharedWith).toEqual([{ series: 'f1', round: 22 }]);
    expect(f2Doc.rounds[0].sharedWith).toBeUndefined();
  });

  it('markShared also matches a series stored earlier, and drops a stale mark', () => {
    const rounds = season2026();
    rounds[0].sharedWith = [{ series: 'f3', round: 9 }];
    const others = new Map<SeriesId, Round[]>([['wec', [round(8, 'losail', '2026-11-28', '2026-11-28', [])]]]);
    markShared(rounds, 'f1', others);
    expect(rounds[0].sharedWith).toBeUndefined();
    expect(rounds[1].sharedWith).toEqual([{ series: 'wec', round: 8 }]);
  });

  it('names the series and the season of a failed calendar, and goes on with the others', async () => {
    const f1 = fakeSource('f1', { failCalendar: 'Jolpica: HTTP 503' });
    const wec = fakeSource('wec', { rounds: { 2026: [round(8, 'losail', '2026-11-28', '2026-11-28', [])] } });
    const { store, deps } = setup([f1.source, wec.source]);
    const report = await syncCalendar(deps);
    expect(report.errors.map((e) => [e.series, e.what, e.message])).toEqual([
      ['f1', 'calendar 2026', 'Jolpica: HTTP 503'],
      ['f1', 'calendar 2027', 'Jolpica: HTTP 503'],
    ]);
    expect(store.docs.has(paths.season('wec', 2026))).toBe(true);
    expect(store.docs.has(paths.season('f1', 2026))).toBe(false);
  });

  it('moves the current season to the next year once this year is over and the next is out', () => {
    const y2026 = season2026();
    const y2027 = [round(1, 'albert_park', '2027-03-05', '2027-03-07', [])];
    expect(currentSeason(new Map([[2026, y2026], [2027, y2027]]), NOW)).toBe(2026);
    const december = new Date('2026-12-15T00:00:00Z');
    expect(currentSeason(new Map([[2026, y2026], [2027, y2027]]), december)).toBe(2027);
    expect(currentSeason(new Map([[2026, y2026]]), december)).toBe(2026);
  });
});

describe('resultsDue', () => {
  const fp1 = session('r22-fp1', 'practice', '2026-11-27T13:30:00Z', '2026-11-27T14:30:00Z');
  const at = (iso: string) => new Date(iso);

  it('is due from the start through the window, every run', () => {
    expect(resultsDue(fp1, 180, at('2026-11-27T13:00:00Z'), undefined, false)).toBe(false);
    expect(resultsDue(fp1, 180, at('2026-11-27T14:00:00Z'), undefined, false)).toBe(true);
    expect(resultsDue(fp1, 180, at('2026-11-27T17:30:00Z'), Date.parse('2026-11-27T17:25:00Z'), false)).toBe(true);
  });

  it('is due once an hour for a day after the window, then left to the backfill', () => {
    const after = at('2026-11-27T18:00:00Z');
    expect(resultsDue(fp1, 180, after, Date.parse('2026-11-27T17:30:00Z'), false)).toBe(false);
    expect(resultsDue(fp1, 180, after, Date.parse('2026-11-27T16:59:00Z'), false)).toBe(true);
    const dayLater = new Date(Date.parse('2026-11-27T17:30:00Z') + LATE_HOURS * 3_600_000 + 60_000);
    expect(resultsDue(fp1, 180, dayLater, undefined, false)).toBe(false);
    expect(resultsDue(fp1, 180, dayLater, undefined, true)).toBe(true);
  });

  it('is never due when final, cancelled, or a session with no window', () => {
    const now = at('2026-11-27T15:00:00Z');
    expect(resultsDue({ ...fp1, resultsState: 'final' }, 180, now, undefined, true)).toBe(false);
    expect(resultsDue({ ...fp1, status: 'cancelled' }, 180, now, undefined, true)).toBe(false);
    expect(resultsDue(fp1, 0, now, undefined, true)).toBe(false);
  });

  it('takes the start plus two hours as the end when the source gives none', () => {
    const noEnd = { ...fp1, endUtc: null };
    expect(resultsDue(noEnd, 60, at('2026-11-27T16:29:00Z'), Date.parse('2026-11-27T16:28:00Z'), false)).toBe(true);
    expect(resultsDue(noEnd, 60, at('2026-11-27T16:31:00Z'), Date.parse('2026-11-27T16:28:00Z'), false)).toBe(false);
  });
});

describe('syncResults', () => {
  const resultOf = (winner: string) => (_r: Round, s: Session): ResultDoc | null =>
    s.id === 'r22-fp1' || s.id === 'r22-race'
      ? { state: 'provisional', fetchedAt: 'any', rows: rows(winner), source: { name: 'fake', url: 'https://example.test/r' } }
      : null;

  it('writes a due result as provisional, with a templated summary, and marks the session', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() }, results: resultOf('First Driver') });
    const { store, deps } = setup([f1.source]);
    await syncCalendar(deps);
    const report = await syncResults(deps);
    expect(report.errors).toEqual([]);
    expect(f1.calls.results).toEqual(['2026/r22-fp1']);
    const path = paths.result('f1', 2026, 'r22-fp1');
    expect(report.written).toEqual([path, paths.season('f1', 2026)]);
    const doc = store.docs.get(path) as unknown as ResultDoc;
    expect(doc.state).toBe('provisional');
    expect(doc.summary).toContain('First Driver');
    expect(sessionIn(seasonDoc(store, 'f1', 2026), 'r22-fp1').resultsState).toBe('provisional');
    // practice brings no standings
    expect(f1.calls.standings).toEqual([]);
  });

  it('does not write the same result twice, and makes it final once the window has passed', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() }, results: resultOf('First Driver') });
    const { store, deps, setNow } = setup([f1.source]);
    await syncCalendar(deps);
    const lastTry = new Map<string, number>();
    await syncResults(deps, { lastTry });
    setNow(new Date('2026-11-27T16:35:00Z'));
    expect((await syncResults(deps, { lastTry })).written).toEqual([]);
    setNow(new Date('2026-11-27T17:40:00Z'));
    const late = await syncResults(deps, { lastTry });
    expect(late.written).toContain(paths.result('f1', 2026, 'r22-fp1'));
    expect((store.docs.get(paths.result('f1', 2026, 'r22-fp1')) as unknown as ResultDoc).state).toBe('final');
    expect(sessionIn(seasonDoc(store, 'f1', 2026), 'r22-fp1').resultsState).toBe('final');
    // final: never asked again
    const asked = f1.calls.results.length;
    setNow(new Date('2026-11-27T19:00:00Z'));
    await syncResults(deps, { lastTry, backfill: true });
    expect(f1.calls.results.filter((c) => c === '2026/r22-fp1')).toHaveLength(asked);
  });

  it('marks a due session pending while its source has no result yet', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const { store, deps } = setup([f1.source]);
    await syncCalendar(deps);
    const report = await syncResults(deps);
    expect(report.written).toEqual([paths.season('f1', 2026)]);
    expect(sessionIn(seasonDoc(store, 'f1', 2026), 'r22-fp1').resultsState).toBe('pending');
  });

  it('reads the standings after a race result, and writes each table when it changed', async () => {
    const f1 = fakeSource('f1', {
      rounds: { 2026: season2026() },
      results: resultOf('First Driver'),
      standings: () => ({ drivers: table('drivers', 22, 400), teams: table('teams', 22, 700) }),
    });
    const { store, deps } = setup([f1.source], new Date('2026-11-29T18:30:00Z'));
    await syncCalendar(deps);
    const report = await syncResults(deps);
    expect(f1.calls.standings).toEqual([2026]);
    expect(report.written).toContain(paths.standings('f1', 2026, 'drivers'));
    expect(report.written).toContain(paths.standings('f1', 2026, 'teams'));
    expect(store.docs.get(paths.standings('f1', 2026, 'drivers'))).toEqual(table('drivers', 22, 400));
  });

  it('leaves a missed weekend to the daily backfill, which fills it in', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() }, results: (_r, s) => (s.id === 'r21-race' ? { state: 'provisional', fetchedAt: 'any', rows: rows('Vegas Winner') } : null) });
    const { store, deps } = setup([f1.source]);
    await syncCalendar(deps);
    await syncResults(deps);
    expect(f1.calls.results).not.toContain('2026/r21-race');
    const [calendar, results, standings] = await dailySync(deps);
    expect(calendar.kind).toBe('calendar');
    expect(f1.calls.results).toContain('2026/r21-race');
    expect(results.written).toContain(paths.result('f1', 2026, 'r21-race'));
    expect((store.docs.get(paths.result('f1', 2026, 'r21-race')) as unknown as ResultDoc).state).toBe('final');
    expect(standings.kind).toBe('results');
  });

  it('names the series and the session of a failed result, and goes on', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    f1.source.results = async () => {
      throw new Error('page changed');
    };
    const { deps } = setup([f1.source]);
    await syncCalendar(deps);
    const report = await syncResults(deps);
    expect(report.errors.map((e) => [e.series, e.what, e.message])).toEqual([['f1', 'results 2026 r22-fp1', 'page changed']]);
  });

  it('refreshes the statuses from the clock', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const { store, deps } = setup([f1.source]);
    await syncCalendar(deps);
    await syncResults(deps);
    const doc = seasonDoc(store, 'f1', 2026);
    expect(sessionIn(doc, 'r21-race').status).toBe('completed');
    expect(sessionIn(doc, 'r22-fp1').status).toBe('completed');
    expect(sessionIn(doc, 'r22-race').status).toBe('upcoming');
  });
});

describe('writeMeta', () => {
  it('writes when the daily run ran, with the versions, the sources and the errors', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const wec = fakeSource('wec', { failCalendar: 'WEC site down' });
    const { store, deps } = setup([f1.source, wec.source]);
    const reports = await dailySync(deps);
    expect(await writeMeta(deps, reports)).toBe(true);
    const meta = store.docs.get(paths.meta()) as unknown as SyncMeta;
    expect(meta.lastSyncAt).toBe(NOW.toISOString());
    expect(meta.lastCalendarAt).toBe(NOW.toISOString());
    expect(meta.versions.f1).toBe(`2026:${seasonDoc(store, 'f1', 2026).contentHash}`);
    expect(meta.versions.wec).toBeUndefined();
    expect(meta.sourceNotes).toBe('Formula 1: fake f1; FIA WEC: fake wec');
    expect(meta.errors?.map((e) => [e.series, e.what])).toEqual([
      ['wec', 'calendar 2026'],
      ['wec', 'calendar 2027'],
    ]);
  });

  it('skips a results run that wrote nothing and failed nothing, and keeps the last calendar time', async () => {
    const f1 = fakeSource('f1', { rounds: { 2026: season2026() } });
    const { store, deps, setNow } = setup([f1.source]);
    await writeMeta(deps, await dailySync(deps));
    setNow(new Date('2026-11-27T20:00:00Z'));
    const quiet = { kind: 'results' as const, at: '2026-11-27T20:00:00.000Z', written: [], errors: [] };
    expect(await writeMeta(deps, [quiet])).toBe(false);
    const wrote = { ...quiet, written: [paths.result('f1', 2026, 'r22-fp1')] };
    expect(await writeMeta(deps, [wrote])).toBe(true);
    const meta = store.docs.get(paths.meta()) as unknown as SyncMeta;
    expect(meta.lastSyncAt).toBe('2026-11-27T20:00:00.000Z');
    expect(meta.lastCalendarAt).toBe(NOW.toISOString());
  });
});
