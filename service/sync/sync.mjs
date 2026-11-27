// The sync (RW.RESEARCH 1.1 and 6.2): what the desktop service runs on its schedule. The calendar once a day (each
// season document written only when its content hash changes), results while a session's results are due (every five
// minutes inside the session's window, then hourly for a day until they are final), and the standings after each race
// or sprint result. Sources only read; this module alone writes, through a DocStore (firestore.mjs or a fake).
//
// The service runs under plain Node, so the model's paths and names are restated here rather than imported from
// src/lib/raceData.ts (that module pulls in the Firebase web SDK); test/sync.test.ts holds the two in step.

import { createHash } from 'node:crypto';
import { roundSpan, statusAt } from './source.mjs';
import { resultSummary } from './texts.mjs';

/** @typedef {import('../../src/lib/raceData.ts').SeriesId} SeriesId */
/** @typedef {import('../../src/lib/raceData.ts').Round} Round */
/** @typedef {import('../../src/lib/raceData.ts').Session} Session */
/** @typedef {import('../../src/lib/raceData.ts').SeasonDoc} SeasonDoc */
/** @typedef {import('../../src/lib/raceData.ts').SeriesDoc} SeriesDoc */
/** @typedef {import('../../src/lib/raceData.ts').ResultDoc} ResultDoc */
/** @typedef {import('../../src/lib/raceData.ts').StandingsDoc} StandingsDoc */
/** @typedef {import('../../src/lib/raceData.ts').SyncMeta} SyncMeta */
/** @typedef {import('./source.mjs').Source} Source */
/** @typedef {import('./source.mjs').SourceDeps} SourceDeps */
/** @typedef {import('./source.mjs').Repair} Repair */
/** @typedef {import('./http.mjs').Get} Get */
/** @typedef {import('./firestore.mjs').DocStore} DocStore */
/** @typedef {import('./firestore.mjs').Data} Data */

/**
 * @typedef {object} SyncDeps
 * @property {DocStore} store
 * @property {Source[]} sources
 * @property {Get} get
 * @property {() => Date} now
 * @property {Repair} [repair] The WEC's AI repair (ai.mjs), handed to the WEC source only.
 * @property {{ info(message: string): void, warn(message: string): void }} [log]
 * @property {AbortSignal} [signal]
 */

/** @typedef {{ series: SeriesId, at: string, what: string, message: string }} SyncError */
/** @typedef {{ kind: 'calendar' | 'results', at: string, written: string[], errors: SyncError[] }} SyncReport */

/** The series' names as the app shows them (the same as raceData.ts SERIES_NAMES). */
export const SERIES_NAMES = /** @type {const} */ ({ f1: 'Formula 1', f2: 'Formula 2', f3: 'Formula 3', f1academy: 'F1 Academy', wec: 'FIA WEC', fe: 'Formula E' });
const SERIES_ORDER = /** @type {SeriesId[]} */ (Object.keys(SERIES_NAMES));

/** The documents the sync writes (the same paths as raceData.ts). */
export const paths = {
  /** @param {SeriesId} s */
  seriesDoc: (s) => `series/${s}`,
  /** @param {SeriesId} s @param {number} y */
  season: (s, y) => `series/${s}/seasons/${y}`,
  /** @param {SeriesId} s @param {number} y @param {string} id */
  result: (s, y, id) => `series/${s}/seasons/${y}/results/${id}`,
  /** @param {SeriesId} s @param {number} y @param {'drivers' | 'teams'} k */
  standings: (s, y, k) => `series/${s}/seasons/${y}/standings/${k}`,
  meta: () => 'meta/sync',
};

/** After a session's window has passed, its results are tried once an hour for a day more, then left. */
export const LATE_TRY_MINUTES = 60;
export const LATE_HOURS = 24;
const MAX_ERRORS = 20;

/** JSON with sorted keys, so a stored document and a fresh one compare whatever order their fields came back in. @param {unknown} v @returns {string} */
export function stableJson(v) {
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : stableJson(x))).join(',')}]`;
  if (v && typeof v === 'object') {
    const entries = Object.entries(v).filter(([, x]) => x !== undefined).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries.map(([k, x]) => `${JSON.stringify(k)}:${stableJson(x)}`).join(',')}}`;
  }
  return JSON.stringify(v ?? null);
}

/** The season's content hash: the rounds without the fetch times, which change on every run. @param {Round[]} rounds */
export function contentHash(rounds) {
  const plain = rounds.map((r) => ({ ...r, source: { name: r.source.name, url: r.source.url } }));
  return createHash('sha256').update(stableJson(plain)).digest('hex').slice(0, 16);
}

/** The seasons the sync looks at: this year and the next, and last year in January (late results, final standings). @param {Date} now */
export function seasonsAround(now) {
  const y = now.getUTCFullYear();
  return now.getUTCMonth() === 0 ? [y - 1, y, y + 1] : [y, y + 1];
}

/** What a source's call gets: the WEC alone gets the AI repair (decision D3). @param {Source} source @param {SyncDeps} deps @returns {SourceDeps} */
const sourceDeps = (source, deps) => ({ get: deps.get, now: deps.now, ...(source.series === 'wec' && deps.repair ? { repair: deps.repair } : {}) });

/** @param {unknown} e */
const messageOf = (e) => (e instanceof Error ? e.message : String(e));

/** The stored results state of each session is the sync's own: a fresh calendar carries it over. @param {Round[]} rounds @param {SeasonDoc | null} old */
export function carryOver(rounds, old) {
  /** @type {Map<string, Session['resultsState']>} */
  const states = new Map();
  for (const r of old?.rounds ?? []) for (const s of r.sessions ?? []) states.set(s.id, s.resultsState);
  for (const r of rounds) for (const s of r.sessions) s.resultsState = states.get(s.id) ?? s.resultsState ?? 'none';
  return rounds;
}

/**
 * Marks the rounds another series races on the same weekend (RW.RESEARCH 1.7): the same circuit key and dates that
 * overlap (F2 and F3 at Monaco start a day before F1, so overlap, not equality).
 * @param {Round[]} rounds @param {SeriesId} series @param {Map<SeriesId, Round[]>} others
 */
export function markShared(rounds, series, others) {
  for (const r of rounds) {
    /** @type {{ series: SeriesId, round: number }[]} */
    const shared = [];
    for (const other of SERIES_ORDER) {
      if (other === series) continue;
      for (const q of others.get(other) ?? []) {
        if (r.circuitKey && q.circuitKey === r.circuitKey && q.startDate <= r.endDate && r.startDate <= q.endDate) shared.push({ series: other, round: q.round });
      }
    }
    if (shared.length) r.sharedWith = shared;
    else delete r.sharedWith;
  }
  return rounds;
}

/**
 * The season a series is in at `now`: this year while a round of it is still to come, else the next year once its
 * calendar is there.
 * @param {Map<number, Round[]>} bySeason @param {Date} now
 */
export function currentSeason(bySeason, now) {
  const y = now.getUTCFullYear();
  const today = now.toISOString().slice(0, 10);
  const thisYear = bySeason.get(y) ?? [];
  const over = thisYear.length > 0 && thisYear.every((r) => r.endDate < today);
  return over && (bySeason.get(y + 1)?.length ?? 0) > 0 ? y + 1 : y;
}

/**
 * The calendars of every source for `seasons`: each season document is written only when its content changed, with
 * the results states carried over and the shared weekends marked; then each series' document.
 * @param {SyncDeps} deps @param {number[]} [seasons]
 * @returns {Promise<SyncReport>}
 */
export async function syncCalendar(deps, seasons = seasonsAround(deps.now())) {
  const at = deps.now().toISOString();
  /** @type {SyncReport} */
  const report = { kind: 'calendar', at, written: [], errors: [] };
  /** @type {Map<string, SeasonDoc>} */
  const stored = new Map();
  /** @type {Map<string, Round[]>} */
  const fresh = new Map();
  const key = (/** @type {SeriesId} */ s, /** @type {number} */ y) => `${s}/${y}`;
  for (const source of deps.sources) {
    for (const season of seasons) {
      deps.signal?.throwIfAborted();
      const old = /** @type {SeasonDoc | null} */ (await deps.store.get(paths.season(source.series, season)));
      if (old) stored.set(key(source.series, season), old);
      try {
        const rounds = await source.calendar(season, sourceDeps(source, deps));
        if (rounds) fresh.set(key(source.series, season), carryOver(rounds, old));
      } catch (e) {
        deps.signal?.throwIfAborted();
        report.errors.push({ series: source.series, at, what: `calendar ${season}`, message: messageOf(e) });
        deps.log?.warn(`${source.series} calendar ${season}: ${messageOf(e)}`);
      }
    }
  }
  const all = new Set([...stored.keys(), ...fresh.keys()].map((k) => k.split('/')[0]));
  for (const source of deps.sources) {
    /** @type {Map<number, Round[]>} */
    const bySeason = new Map();
    for (const season of seasons) {
      const k = key(source.series, season);
      const rounds = fresh.get(k);
      const old = stored.get(k);
      if (rounds) {
        /** @type {Map<SeriesId, Round[]>} */
        const others = new Map();
        for (const s of /** @type {SeriesId[]} */ ([...all])) others.set(s, fresh.get(key(s, season)) ?? stored.get(key(s, season))?.rounds ?? []);
        markShared(rounds, source.series, others);
        const hash = contentHash(rounds);
        if (old?.contentHash !== hash) {
          /** @type {SeasonDoc} */
          const doc = { series: source.series, season, rounds, contentHash: hash };
          await deps.store.set(paths.season(source.series, season), /** @type {Data} */ (/** @type {unknown} */ (doc)));
          report.written.push(paths.season(source.series, season));
        }
      }
      const known = rounds ?? old?.rounds;
      if (known?.length) bySeason.set(season, known);
    }
    const want = { name: SERIES_NAMES[source.series], currentSeason: currentSeason(bySeason, deps.now()) };
    const doc = /** @type {Partial<SeriesDoc> | null} */ (await deps.store.get(paths.seriesDoc(source.series)));
    if (doc?.name !== want.name || doc?.currentSeason !== want.currentSeason) {
      await deps.store.set(paths.seriesDoc(source.series), { ...doc, ...want });
      report.written.push(paths.seriesDoc(source.series));
    }
  }
  return report;
}

/** A session's end, or its start plus two hours when the source gives none. @param {Session} s */
const endMs = (s) => (s.endUtc ? Date.parse(s.endUtc) : Date.parse(s.startUtc) + 2 * 3_600_000);

/**
 * Whether a session's results are due at `now`: inside its window (every run), or in the day after it (once an hour,
 * by `lastTry`), and not final. A backfill (the daily run) takes every past session not final, so a new install or a
 * missed weekend fills in.
 * @param {Session} s @param {number} windowMinutes @param {Date} now @param {number | undefined} lastTry @param {boolean} backfill
 */
export function resultsDue(s, windowMinutes, now, lastTry, backfill) {
  if (windowMinutes <= 0 || s.resultsState === 'final' || s.status === 'cancelled') return false;
  const t = now.getTime();
  if (t < Date.parse(s.startUtc)) return false;
  const windowEnd = endMs(s) + windowMinutes * 60_000;
  if (t <= windowEnd) return true;
  if (backfill) return true;
  if (t > windowEnd + LATE_HOURS * 3_600_000) return false;
  return lastTry === undefined || t - lastTry >= LATE_TRY_MINUTES * 60_000;
}

/**
 * The results due now, for every source and season. A result is written when it is new or changed; it is final once
 * its window has passed. A new race or sprint result brings the standings. The season document is written again when a
 * session's results state or status changed.
 * @param {SyncDeps} deps
 * @param {{ seasons?: number[], backfill?: boolean, lastTry?: Map<string, number> }} [o] `lastTry`: when each session
 *   was last tried, kept by the service between runs.
 * @returns {Promise<SyncReport>}
 */
export async function syncResults(deps, o = {}) {
  const now = deps.now();
  const at = now.toISOString();
  const lastTry = o.lastTry ?? new Map();
  /** @type {SyncReport} */
  const report = { kind: 'results', at, written: [], errors: [] };
  for (const source of deps.sources) {
    for (const season of o.seasons ?? seasonsAround(now)) {
      deps.signal?.throwIfAborted();
      const doc = /** @type {SeasonDoc | null} */ (await deps.store.get(paths.season(source.series, season)));
      if (!doc?.rounds?.length) continue;
      let changed = false;
      let standingsDue = false;
      for (const round of doc.rounds) {
        for (const session of round.sessions ?? []) {
          const tryKey = `${source.series}/${season}/${session.id}`;
          if (!resultsDue(session, source.resultsWindowMinutes(session), now, lastTry.get(tryKey), o.backfill === true)) continue;
          lastTry.set(tryKey, now.getTime());
          try {
            const result = await source.results(season, round, session, sourceDeps(source, deps));
            if (!result) {
              if (session.resultsState === 'none') {
                session.resultsState = 'pending';
                changed = true;
              }
              continue;
            }
            const final = now.getTime() > endMs(session) + source.resultsWindowMinutes(session) * 60_000;
            /** @type {ResultDoc} */
            const doc2 = { ...result, state: final ? 'final' : 'provisional', summary: resultSummary(session, result.rows) };
            const path = paths.result(source.series, season, session.id);
            const old = await deps.store.get(path);
            const same = old && stableJson({ ...old, fetchedAt: '' }) === stableJson({ ...doc2, fetchedAt: '' });
            if (!same) {
              await deps.store.set(path, /** @type {Data} */ (/** @type {unknown} */ (doc2)));
              report.written.push(path);
              if (session.kind === 'race' || session.kind === 'sprint') standingsDue = true;
            }
            if (session.resultsState !== doc2.state) {
              session.resultsState = doc2.state;
              changed = true;
            }
          } catch (e) {
            deps.signal?.throwIfAborted();
            report.errors.push({ series: source.series, at, what: `results ${season} ${session.id}`, message: messageOf(e) });
            deps.log?.warn(`${source.series} results ${season} ${session.id}: ${messageOf(e)}`);
          }
        }
      }
      if (refreshStatus(doc.rounds, now)) changed = true;
      if (changed) {
        doc.contentHash = contentHash(doc.rounds);
        await deps.store.set(paths.season(source.series, season), /** @type {Data} */ (/** @type {unknown} */ (doc)));
        report.written.push(paths.season(source.series, season));
      }
      if (standingsDue) await syncStandings(deps, source, season, report);
    }
  }
  return report;
}

/**
 * Session and round statuses from the clock (a stored status goes stale between two calendar runs); true when any changed.
 * @param {Round[]} rounds @param {Date} now
 */
export function refreshStatus(rounds, now) {
  let changed = false;
  for (const r of rounds) {
    for (const s of r.sessions ?? []) {
      if (s.status === 'cancelled') continue;
      const status = statusAt(s, now);
      if (status !== s.status) {
        s.status = status;
        changed = true;
      }
    }
    if (r.status === 'moved' || !r.sessions?.length) continue;
    const { status } = roundSpan(r.sessions, r.timeZone, now, { startDate: r.startDate, endDate: r.endDate });
    if (status !== r.status) {
      r.status = status;
      changed = true;
    }
  }
  return changed;
}

/**
 * The standings of one series and season, each table written when it changed.
 * @param {SyncDeps} deps @param {Source} source @param {number} season @param {SyncReport} report
 */
export async function syncStandings(deps, source, season, report) {
  try {
    const tables = await source.standings(season, sourceDeps(source, deps));
    for (const kind of /** @type {const} */ (['drivers', 'teams'])) {
      const table = tables[kind];
      if (!table) continue;
      const path = paths.standings(source.series, season, kind);
      const old = await deps.store.get(path);
      if (old && stableJson(old) === stableJson(table)) continue;
      await deps.store.set(path, /** @type {Data} */ (/** @type {unknown} */ (table)));
      report.written.push(path);
    }
  } catch (e) {
    deps.signal?.throwIfAborted();
    report.errors.push({ series: source.series, at: report.at, what: `standings ${season}`, message: messageOf(e) });
    deps.log?.warn(`${source.series} standings ${season}: ${messageOf(e)}`);
  }
}

/**
 * The daily run: the calendars, then every past result not yet final (the backfill), then the standings of each
 * series' current season.
 * @param {SyncDeps} deps @param {{ lastTry?: Map<string, number> }} [o]
 * @returns {Promise<SyncReport[]>}
 */
export async function dailySync(deps, o = {}) {
  const calendar = await syncCalendar(deps);
  const results = await syncResults(deps, { backfill: true, lastTry: o.lastTry });
  /** @type {SyncReport} */
  const standings = { kind: 'results', at: deps.now().toISOString(), written: [], errors: [] };
  for (const source of deps.sources) {
    const doc = /** @type {Partial<SeriesDoc> | null} */ (await deps.store.get(paths.seriesDoc(source.series)));
    await syncStandings(deps, source, doc?.currentSeason ?? deps.now().getUTCFullYear(), standings);
  }
  return [calendar, results, standings];
}

/**
 * meta/sync after a run: when it ran, the version of each series' current season, and the run's errors (the page
 * shows them beside the data). Written after the daily run always, after a results run only when it wrote or failed.
 * @param {SyncDeps} deps @param {SyncReport[]} reports
 */
export async function writeMeta(deps, reports) {
  const wrote = reports.some((r) => r.written.length > 0);
  const errors = reports.flatMap((r) => r.errors).slice(0, MAX_ERRORS);
  const daily = reports.some((r) => r.kind === 'calendar');
  if (!daily && !wrote && errors.length === 0) return false;
  const old = /** @type {(Partial<SyncMeta> & Data) | null} */ (await deps.store.get(paths.meta()));
  /** @type {Partial<Record<SeriesId, string>>} */
  const versions = { ...(old?.versions ?? {}) };
  for (const source of deps.sources) {
    const doc = /** @type {Partial<SeriesDoc> | null} */ (await deps.store.get(paths.seriesDoc(source.series)));
    const season = doc?.currentSeason ? /** @type {SeasonDoc | null} */ (await deps.store.get(paths.season(source.series, doc.currentSeason))) : null;
    if (season?.contentHash) versions[source.series] = `${season.season}:${season.contentHash}`;
  }
  const at = reports[reports.length - 1]?.at ?? deps.now().toISOString();
  /** @type {SyncMeta} */
  const meta = {
    lastSyncAt: at,
    versions,
    sourceNotes: deps.sources.map((s) => `${SERIES_NAMES[s.series]}: ${s.name}`).join('; '),
    errors,
    ...(daily ? { lastCalendarAt: at } : { lastCalendarAt: old?.lastCalendarAt }),
  };
  await deps.store.set(paths.meta(), /** @type {Data} */ (/** @type {unknown} */ (meta)));
  return true;
}
