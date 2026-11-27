// F1 Academy (RW.RESEARCH 1.5): the series' own site, f1academy.com, a Next.js Pages Router site whose pages carry
// their data in the __NEXT_DATA__ script (props.pageProps.pageData). The calendar page has every round with its
// sessions, a round's results page every session's classification, and the two standings pages the tables. The
// site's printed offsets are wrong in summer (Montreal in May as -05:00, Silverstone in July as +00:00), so a
// session's UTC is its local clock in the circuit's IANA zone from our table, the printed offset ignored. Only the
// pages are read, never their /_next/data/ twins, and nothing here goes near an AI model (decision D3).

import { findCircuit } from '../circuits.mjs';
import { ShapeError } from '../http.mjs';
import { num, roundSpan, sessionId, statusAt } from '../source.mjs';
import { localToUtc } from '../time.mjs';

/** @typedef {import('../source.mjs').Round} Round */
/** @typedef {import('../source.mjs').Session} Session */
/** @typedef {import('../source.mjs').SessionKind} SessionKind */
/** @typedef {import('../source.mjs').ResultDoc} ResultDoc */
/** @typedef {import('../source.mjs').ResultRow} ResultRow */
/** @typedef {import('../source.mjs').StandingsDoc} StandingsDoc */
/** @typedef {import('../source.mjs').SourceDeps} SourceDeps */
/** @typedef {import('../../../src/lib/raceData.ts').StandingsKind} StandingsKind */

export const NAME = 'F1 Academy (f1academy.com)';
const SRC = 'f1academy';
export const BASE = 'https://www.f1academy.com';
const HTML_ACCEPT = { accept: 'text/html' };

/** The calendar page; another season than the site's current one by its id (lower case: seasonid). @param {number} [seasonId] */
export const calendarUrl = (seasonId) => `${BASE}/Racing-Series/Calendar${seasonId === undefined ? '' : `?seasonid=${seasonId}`}`;
/** A round's results page. @param {number} raceId */
export const resultsUrl = (raceId) => `${BASE}/Racing-Series/Results?raceid=${raceId}`;
/**
 * A standings page; another season than the current one by its id (camel case here: seasonId, the lower case is
 * ignored).
 * @param {StandingsKind} kind @param {number} [seasonId]
 */
export const standingsUrl = (kind, seasonId) =>
  `${BASE}/Racing-Series/Standings/${kind === 'drivers' ? 'Driver' : 'Team'}${seasonId === undefined ? '' : `?seasonId=${seasonId}`}`;

// ---------- small readers of unknown JSON ----------

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {unknown} v @param {string} at @returns {Record<string, unknown>} */
function rec(v, at) {
  if (!isRecord(v)) throw new ShapeError(SRC, `${at} is not an object`);
  return v;
}

/** @param {unknown} v @param {string} at @returns {unknown[]} */
function list(v, at) {
  if (!Array.isArray(v)) throw new ShapeError(SRC, `${at} is not a list`);
  return v;
}

/** A value's text, trimmed, or null. @param {unknown} v */
function optText(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const t = v.replace(/\s+/g, ' ').trim();
  return t === '' ? null : t;
}

/** @param {unknown} v @param {string} at */
function text(v, at) {
  const t = optText(v);
  if (t === null) throw new ShapeError(SRC, `${at} is missing`);
  return t;
}

/** @param {unknown} v @param {string} at */
function int(v, at) {
  const n = num(v);
  if (n === null || !Number.isInteger(n)) throw new ShapeError(SRC, `${at} is not a whole number`);
  return n;
}

// ---------- pages ----------

/**
 * A page's props.pageProps, from its __NEXT_DATA__ script.
 * @param {string} html
 * @returns {Record<string, unknown>}
 */
export function parseNextData(html) {
  const m = /<script\b[^>]*\bid="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/i.exec(html);
  if (!m) throw new ShapeError(SRC, 'no __NEXT_DATA__ in the page');
  /** @type {unknown} */
  let data;
  try {
    data = JSON.parse(m[1]);
  } catch {
    throw new ShapeError(SRC, '__NEXT_DATA__ is not JSON');
  }
  const props = rec(rec(data, '__NEXT_DATA__').props, 'props');
  return rec(props.pageProps, 'props.pageProps');
}

/** A page's pageData. @param {Record<string, unknown>} pageProps */
const pageDataOf = (pageProps) => rec(pageProps.pageData, 'pageProps.pageData');

/**
 * The site's id of a season (pageProps.seasonData: "2026 F1 Academy", 2026-01-01), or null when the site has not got
 * it. The main championship wins over any other entry of the same year.
 * @param {Record<string, unknown>} pageProps @param {number} season
 */
export function seasonIdOf(pageProps, season) {
  const seasons = list(pageProps.seasonData, 'pageProps.seasonData').map((v, i) => rec(v, `seasonData[${i}]`));
  const ofYear = seasons.filter((s) => {
    const name = optText(s.SeasonName) ?? '';
    const start = optText(s.SeasonStartDate) ?? '';
    return name.startsWith(`${season} `) || name === String(season) || start.startsWith(`${season}-`);
  });
  const pick = ofYear.find((s) => optText(s.SeasonTypeCode) === 'MAIN') ?? ofYear[0];
  return pick ? int(pick.SeasonId, 'seasonData.SeasonId') : null;
}

/**
 * A page's HTML, or null for a 404. Any other answer but a 200 throws.
 * @param {string} url @param {SourceDeps} deps
 */
async function readPage(url, deps) {
  const r = await deps.get(url, HTML_ACCEPT);
  if (r.status === 200) return r.text;
  if (r.status === 404) return null;
  throw new Error(`${SRC}: HTTP ${r.status} from ${r.url}`);
}

/**
 * A page of the season asked for: the page as the site serves it when that is the season, else the same page with
 * the season's id (checked: the site falls back to its current season on an id it ignores). Null when the site has
 * not got the season or the page is gone.
 * @param {(seasonId?: number) => string} urlOf @param {number} season @param {SourceDeps} deps
 * @returns {Promise<{ pageProps: Record<string, unknown>, url: string, seasonId: number } | null>}
 */
async function seasonPage(urlOf, season, deps) {
  const first = urlOf();
  const html = await readPage(first, deps);
  if (html === null) return null;
  const pageProps = parseNextData(html);
  const seasonId = seasonIdOf(pageProps, season);
  if (seasonId === null) return null;
  if (num(pageDataOf(pageProps).SeasonId) === seasonId) return { pageProps, url: first, seasonId };
  const url = urlOf(seasonId);
  const other = await readPage(url, deps);
  if (other === null) return null;
  const props = parseNextData(other);
  const got = num(pageDataOf(props).SeasonId);
  if (got !== seasonId) throw new ShapeError(SRC, `${url} answered season ${String(got)}, not ${seasonId}`);
  return { pageProps: props, url, seasonId };
}

// ---------- sessions ----------

/**
 * Each session's slug, from its name: "Free Practice": practice, "Qualifying 1": qualifying-1, "Reverse Grid Race":
 * reverse-grid, "Feature Race": feature, "Race 2": race-2. A name met twice takes its order after it.
 * @param {string[]} names
 */
export function sessionSlugs(names) {
  const bases = names.map((name) => {
    const words = name.toLowerCase().replace(/\bfree\s+/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
    const base = words.replace(/\brace\b/g, ' ').replace(/\s+/g, ' ').trim().replace(/ /g, '-');
    return base === '' || /^\d+$/.test(base) ? `race${base === '' ? '' : `-${base}`}` : base;
  });
  /** @type {Map<string, number>} */
  const seen = new Map();
  return bases.map((b) => {
    const count = bases.filter((x) => x === b).length;
    if (count < 2) return b;
    const k = (seen.get(b) ?? 0) + 1;
    seen.set(b, k);
    return `${b}-${k}`;
  });
}

/**
 * Each session's kind from the site's code: PRACTICE, QUALIFYING, and RESULT for a race, the feature race the main one
 * ("race") and the others sprints; a round with no race named "Feature" has its last race as the main one.
 * @param {{ code: string, name: string }[]} sessions
 * @returns {SessionKind[]}
 */
export function sessionKinds(sessions) {
  const races = sessions.flatMap((s, i) => (s.code === 'RESULT' ? [i] : []));
  const feature = races.filter((i) => /feature/i.test(sessions[i].name));
  const main = new Set(feature.length > 0 ? feature : races.slice(-1));
  return sessions.map((s, i) => {
    if (s.code === 'PRACTICE') return 'practice';
    if (s.code === 'QUALIFYING') return 'qualifying';
    return main.has(i) ? 'race' : 'sprint';
  });
}

/** @param {unknown} v @param {string} at */
function localClock(v, at) {
  const t = text(v, at);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) throw new ShapeError(SRC, `${at} is not a local time: ${t}`);
  return t;
}

/** @param {string} local @param {string} timeZone @param {string} at */
function utcOf(local, timeZone, at) {
  try {
    return localToUtc(local, timeZone);
  } catch {
    throw new ShapeError(SRC, `${at}: no UTC for ${local} in ${timeZone}`);
  }
}

/**
 * One race of the calendar page as a Round. UTC is the printed local clock in our circuit's zone (the printed offset
 * is ignored, wrong in summer); the circuit must be in our table.
 * @param {unknown} v @param {string} at @param {Date} now
 * @returns {Round}
 */
export function parseRace(v, at, now) {
  const race = rec(v, at);
  const raceId = int(race.RaceId, `${at}.RaceId`);
  const roundNumber = int(race.RoundNumber, `${at}.RoundNumber`);
  const shortName = optText(race.CircuitShortName);
  const circuitName = optText(race.CircuitName);
  const circuit = findCircuit(shortName, circuitName, optText(race.CountryName));
  if (!circuit) {
    throw new ShapeError(SRC, `${at}: ${shortName ?? '?'} (${circuitName ?? '?'}) is not in the circuit table, so its zone is unknown`);
  }
  const raw = list(race.Sessions, `${at}.Sessions`).map((s, i) => rec(s, `${at}.Sessions[${i}]`));
  const names = raw.map((s, i) => text(s.SessionName, `${at}.Sessions[${i}].SessionName`));
  const slugs = sessionSlugs(names);
  const kinds = sessionKinds(raw.map((s, i) => ({ code: optText(s.SessionCode) ?? '', name: names[i] })));
  /** @type {Session[]} */
  const sessions = raw.map((s, i) => {
    const sat = `${at}.Sessions[${i}]`;
    const start = localClock(s.SessionStartTime, `${sat}.SessionStartTime`);
    const end = optText(s.SessionEndTime);
    const startUtc = utcOf(start, circuit.timeZone, sat);
    const endUtc = end ? utcOf(localClock(end, `${sat}.SessionEndTime`), circuit.timeZone, sat) : null;
    return {
      id: sessionId(roundNumber, slugs[i]),
      kind: kinds[i],
      name: names[i],
      startUtc,
      endUtc,
      localDate: start.slice(0, 10),
      timeConfidence: s.Unconfirmed === true ? 'tbc' : 'confirmed',
      status: statusAt({ startUtc, endUtc }, now, /cancel/i.test(optText(s.State) ?? optText(s.SessionState) ?? '')),
      resultsState: 'none',
    };
  });
  const fallback = { startDate: optText(race.RaceStartDate)?.slice(0, 10) ?? '', endDate: optText(race.RaceEndDate)?.slice(0, 10) ?? '' };
  return {
    round: roundNumber,
    name: shortName ?? circuit.city,
    circuitName: circuitName ?? '',
    city: circuit.city,
    country: circuit.country,
    countryCode: circuit.countryCode,
    timeZone: circuit.timeZone,
    circuitKey: circuit.key,
    lat: null,
    long: null,
    ...roundSpan(sessions, circuit.timeZone, now, fallback),
    source: { name: NAME, url: resultsUrl(raceId), fetchedAt: now.toISOString() },
    sessions,
  };
}

/**
 * The calendar page: the season's id and its rounds in round order.
 * @param {string} html @param {Date} now
 * @returns {{ seasonId: number, rounds: Round[] }}
 */
export function parseCalendar(html, now) {
  const pageData = pageDataOf(parseNextData(html));
  const seasonId = int(pageData.SeasonId, 'pageData.SeasonId');
  const rounds = list(pageData.Races, 'pageData.Races').map((r, i) => parseRace(r, `Races[${i}]`, now));
  return { seasonId, rounds: rounds.sort((a, b) => a.round - b.round) };
}

// ---------- results ----------

/**
 * A classified car. Races give the leader's time and the others' gap ("+0.316", "DNF"); practice and qualifying the
 * best lap.
 * @param {unknown} v @param {string} at @param {boolean} race
 * @returns {ResultRow}
 */
function resultRow(v, at, race) {
  const e = rec(v, at);
  const driverName = [optText(e.DriverForename), optText(e.DriverSurname)].filter(Boolean).join(' ') || optText(e.DriverDisplayName);
  if (!driverName) throw new ShapeError(SRC, `${at} has no driver name`);
  const time = optText(e.TimeOrFinishReason);
  const gap = optText(e.Gap);
  const timeOrGap = !race || gap === null ? time : num(gap) !== null ? `+${gap}` : gap;
  const carNumber = optText(e.CarNumber);
  const driverCode = optText(e.TLA);
  const laps = num(e.LapsCompleted);
  return {
    position: num(e.FinishPosition),
    ...(carNumber ? { carNumber } : {}),
    ...(driverCode ? { driverCode } : {}),
    driverName,
    team: optText(e.TeamName) ?? '',
    timeOrGap: timeOrGap ?? optText(e.ResultStatus) ?? optText(e.DisplayFinishPosition) ?? '',
    ...(laps !== null ? { laps } : {}),
  };
}

/**
 * A results page's classification of one session (found by the slug of its name, as the calendar made it; else by its
 * start), or null while the site has none: no rows, results hidden, not classified, not available yet.
 * @param {string} html @param {Session} session @param {number} round @param {string} timeZone
 * @returns {ResultRow[] | null}
 */
export function parseResults(html, session, round, timeZone) {
  const pageData = pageDataOf(parseNextData(html));
  const all = list(pageData.SessionResults, 'pageData.SessionResults').map((s, i) => rec(s, `SessionResults[${i}]`));
  const names = all.map((s, i) => text(s.SessionName, `SessionResults[${i}].SessionName`));
  const slugs = sessionSlugs(names);
  let i = slugs.findIndex((slug) => sessionId(round, slug) === session.id);
  if (i < 0) {
    i = all.findIndex((s) => {
      const start = optText(s.SessionStartTime);
      return start !== null && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(start) && localToUtc(start, timeZone) === session.startUtc;
    });
  }
  if (i < 0) return null;
  const s = all[i];
  if (s.HideSessionResult === true || s.NoClassification === true || s.SessionResultsAvailable === false) return null;
  const race = (optText(s.SessionType) ?? optText(s.SessionCode)) === 'RESULT';
  const rows = (Array.isArray(s.Results) ? s.Results : []).map((r, j) => resultRow(r, `SessionResults[${i}].Results[${j}]`, race));
  return rows.length > 0 ? rows : null;
}

// ---------- standings ----------

/**
 * A standings page as a StandingsDoc, or null while nobody has points. `afterRound` is the last of the season's races
 * (pageData.SeasonRaces, in order) that gave anyone points.
 * @param {string} html @param {StandingsKind} kind
 * @returns {StandingsDoc | null}
 */
export const parseStandings = (html, kind) => standingsOf(parseNextData(html), kind);

/**
 * parseStandings over a page's props.
 * @param {Record<string, unknown>} pageProps @param {StandingsKind} kind
 * @returns {StandingsDoc | null}
 */
function standingsOf(pageProps, kind) {
  const pageData = pageDataOf(pageProps);
  const raw = list(pageData.Standings, 'pageData.Standings').map((r, i) => rec(r, `Standings[${i}]`));
  let afterRound = 0;
  const rows = raw.map((r, i) => {
    const at = `${kind} Standings[${i}]`;
    const points = num(r.TotalPoints);
    if (points === null) throw new ShapeError(SRC, `${at} has no points`);
    const perRace = Array.isArray(r.RacePoints) ? r.RacePoints : [];
    perRace.forEach((p, k) => {
      const values = Array.isArray(p) ? p : [p];
      if (values.some((x) => (num(x) ?? 0) > 0)) afterRound = Math.max(afterRound, k + 1);
    });
    const name = kind === 'drivers' ? optText(r.FullName) ?? optText(r.DisplayName) : optText(r.DisplayName) ?? optText(r.FullName);
    if (!name) throw new ShapeError(SRC, `${at} has no name`);
    const team = kind === 'drivers' ? optText(r.TeamName) : null;
    return { position: num(r.Position) ?? i + 1, name, ...(team ? { team } : {}), points };
  });
  if (rows.length === 0 || afterRound === 0) return null;
  return { kind, afterRound, rows };
}

// ---------- the source ----------

/**
 * How long after a session's end its results are polled: 30 minutes for every session (the site classifies practice
 * too).
 * @param {Session} _session
 */
export const resultsWindowMinutes = (_session) => 30;

/** @type {import('../source.mjs').Source} */
export const source = {
  series: 'f1academy',
  name: NAME,

  async calendar(season, deps) {
    const page = await seasonPage(calendarUrl, season, deps);
    if (!page) return null;
    const pageData = pageDataOf(page.pageProps);
    const now = deps.now();
    const rounds = list(pageData.Races, 'pageData.Races').map((r, i) => parseRace(r, `Races[${i}]`, now));
    return rounds.length > 0 ? rounds.sort((a, b) => a.round - b.round) : null;
  },

  async results(season, round, session, deps) {
    let raceId = num(/[?&]raceid=(\d+)/i.exec(round.source?.url ?? '')?.[1]);
    if (raceId === null) {
      const page = await seasonPage(calendarUrl, season, deps);
      const races = page ? list(pageDataOf(page.pageProps).Races, 'pageData.Races').filter(isRecord) : [];
      raceId = num(races.find((r) => num(r.RoundNumber) === round.round)?.RaceId);
    }
    if (raceId === null) return null;
    const url = resultsUrl(raceId);
    const html = await readPage(url, deps);
    if (html === null) return null;
    const rows = parseResults(html, session, round.round, round.timeZone);
    if (!rows) return null;
    return { state: 'provisional', fetchedAt: deps.now().toISOString(), rows, source: { name: NAME, url } };
  },

  async standings(season, deps) {
    const drivers = await seasonPage((id) => standingsUrl('drivers', id), season, deps);
    if (!drivers) return { drivers: null, teams: null };
    const sameAsServed = drivers.url === standingsUrl('drivers');
    const teamsHtml = await readPage(standingsUrl('teams', sameAsServed ? undefined : drivers.seasonId), deps);
    /** @type {StandingsDoc | null} */
    let teams = null;
    if (teamsHtml !== null) {
      const props = parseNextData(teamsHtml);
      const got = num(pageDataOf(props).SeasonId);
      if (got !== drivers.seasonId) throw new ShapeError(SRC, `the team standings answered season ${String(got)}, not ${drivers.seasonId}`);
      teams = standingsOf(props, 'teams');
    }
    return { drivers: standingsOf(drivers.pageProps, 'drivers'), teams };
  },

  resultsWindowMinutes,
};
