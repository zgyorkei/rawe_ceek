// What every series' source module gives the sync (one module per series, RW.RESEARCH 1.1), and the helpers they
// share. A source only reads and parses: it never writes, never calls an AI model (decision D3: no AI on F1, F2, F3 or
// F1 Academy content), and throws a ShapeError when an answer no longer has the shape its parser knows.

import { localDateOf } from './time.mjs';

/** @typedef {import('../../src/lib/raceData.ts').SeriesId} SeriesId */
/** @typedef {import('../../src/lib/raceData.ts').Round} Round */
/** @typedef {import('../../src/lib/raceData.ts').Session} Session */
/** @typedef {import('../../src/lib/raceData.ts').SessionKind} SessionKind */
/** @typedef {import('../../src/lib/raceData.ts').ResultDoc} ResultDoc */
/** @typedef {import('../../src/lib/raceData.ts').ResultRow} ResultRow */
/** @typedef {import('../../src/lib/raceData.ts').StandingsDoc} StandingsDoc */
/** @typedef {import('./http.mjs').Get} Get */

/**
 * An AI repair step (service/sync/ai.mjs), given only to the WEC source (RW.RESEARCH 1.8 and 9.4; decision D3 keeps it
 * off F1, F2, F3 and F1 Academy): the page's text and what to read from it; it answers the rows as plain JSON, or null.
 * The source validates what comes back as it validates its own parse.
 * @typedef {(task: { series: SeriesId, what: 'results' | 'standings', url: string, text: string }) => Promise<unknown>} Repair
 */

/**
 * What a source's calls get: the polite getter, the clock, and (the WEC only, when the user set a key) the AI repair.
 * @typedef {{ get: Get, now: () => Date, repair?: Repair }} SourceDeps
 */

/**
 * A series' source.
 * @typedef {object} Source
 * @property {SeriesId} series
 * @property {string} name The source as the app credits it, such as "Jolpica-F1 (CC BY-NC-SA 4.0)".
 * @property {(season: number, deps: SourceDeps) => Promise<Round[] | null>} calendar The season's rounds with their
 *   sessions, or null when the source has not published the season (yet).
 * @property {(season: number, round: Round, session: Session, deps: SourceDeps) => Promise<ResultDoc | null>} results
 *   One session's classification, or null while the source has none.
 * @property {(season: number, deps: SourceDeps) => Promise<{ drivers: StandingsDoc | null, teams: StandingsDoc | null }>} standings
 * @property {(session: Session) => number} resultsWindowMinutes How long after a session's end its results are polled
 *   (RW.RESEARCH 1.1's cadence), 0 for none (a practice the source keeps no classification of).
 */

/**
 * A session's id, unique inside its season and safe as a Firestore document id: "r22-race", "r8-q-hypercar".
 * @param {number} round @param {string} slug
 */
export const sessionId = (round, slug) => `r${round}-${slug.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;

/**
 * A session's status at `now` from its times (a source's own cancelled flag wins).
 * @param {{ startUtc: string, endUtc: string | null }} s @param {Date} now @param {boolean} [cancelled]
 * @returns {import('../../src/lib/raceData.ts').SessionStatus}
 */
export function statusAt(s, now, cancelled = false) {
  if (cancelled) return 'cancelled';
  const t = now.getTime();
  const start = Date.parse(s.startUtc);
  const end = s.endUtc ? Date.parse(s.endUtc) : start + 2 * 3_600_000;
  return t < start ? 'upcoming' : t < end ? 'live' : 'completed';
}

/**
 * A round's dates and status from its sessions (the session dates, never a meeting's own dates: F2 and F3 at Monaco
 * start a day before theirs, RW.RESEARCH 1.4). With no session, `fallback` gives the dates.
 * @param {Session[]} sessions @param {string} timeZone @param {Date} now
 * @param {{ startDate: string, endDate: string }} [fallback]
 * @returns {Pick<Round, 'startDate' | 'endDate' | 'status'>}
 */
export function roundSpan(sessions, timeZone, now, fallback) {
  const dates = sessions.map((s) => s.localDate ?? localDateOf(s.startUtc, timeZone)).sort();
  const startDate = dates[0] ?? fallback?.startDate ?? '';
  const endDate = dates[dates.length - 1] ?? fallback?.endDate ?? startDate;
  const live = sessions.filter((s) => s.status !== 'cancelled');
  /** @type {Round['status']} */
  let status = 'scheduled';
  if (sessions.length > 0 && live.length === 0) status = 'cancelled';
  else if (live.some((s) => s.status === 'live')) status = 'live';
  else if (live.length > 0 && live.every((s) => s.status === 'completed')) status = 'completed';
  else if (live.some((s) => s.status === 'completed')) status = 'live';
  return { startDate, endDate, status };
}

/** A number from a source's text ("12", " 25.5 ", "-"), or null. @param {unknown} v */
export function num(v) {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v !== 'string' || v.trim() === '') return null;
  const n = Number(v.trim().replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

/** Decodes the HTML entities a scraped cell holds. @param {string} s */
export function decodeEntities(s) {
  /** @type {Record<string, string>} */
  const named = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'" };
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+|#39);/gi, (all, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return named[e.toLowerCase()] ?? all;
  });
}

/** An HTML fragment's text: tags out, entities decoded, white space folded. @param {string} html */
export const textOf = (html) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
