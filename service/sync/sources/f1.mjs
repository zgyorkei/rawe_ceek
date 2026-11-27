// Formula 1 (RW.RESEARCH 1.3). Jolpica-F1 (the Ergast successor, https://api.jolpi.ca/ergast/f1/) gives the calendar,
// the results and the standings; OpenF1's sessions add each session's end and its cancelled flag when OpenF1 answers.
// OpenF1 refuses every request without a key while an F1 session is live (HTTP 401), so the calendar never depends on
// it: Jolpica alone is a whole calendar, with placeholder ends. formula1.com and api.formula1.com are never read, and
// nothing here goes near an AI model (decision D3).

import { findCircuit } from '../circuits.mjs';
import { ShapeError, okText } from '../http.mjs';
import { num, roundSpan, sessionId, statusAt } from '../source.mjs';
import { addMinutes, localDateOf, localToUtc, toUtc } from '../time.mjs';

/** @typedef {import('../source.mjs').Round} Round */
/** @typedef {import('../source.mjs').Session} Session */
/** @typedef {import('../source.mjs').SessionKind} SessionKind */
/** @typedef {import('../source.mjs').ResultDoc} ResultDoc */
/** @typedef {import('../source.mjs').ResultRow} ResultRow */
/** @typedef {import('../source.mjs').StandingsDoc} StandingsDoc */
/** @typedef {import('../source.mjs').SourceDeps} SourceDeps */
/** @typedef {import('../../../src/lib/raceData.ts').StandingsKind} StandingsKind */

export const JOLPICA = 'https://api.jolpi.ca/ergast/f1';
export const OPENF1 = 'https://api.openf1.org/v1';
/** The credit the app shows (Jolpica's licence asks for it, RW.RESEARCH 1.3). */
export const NAME = 'Jolpica-F1 (CC BY-NC-SA 4.0)';
/** The credit of a calendar OpenF1's sessions were merged into. */
export const NAME_WITH_OPENF1 = `${NAME} and OpenF1`;
const SRC = 'f1';
const JSON_ACCEPT = { accept: 'application/json' };
const DAY_MS = 86_400_000;

/** @param {number} season */
export const scheduleUrl = (season) => `${JOLPICA}/${season}.json?limit=100`;
/** @param {number} season */
export const openF1SessionsUrl = (season) => `${OPENF1}/sessions?year=${season}`;

/** The classifications Jolpica keeps (no sprint qualifying: its /sprintqualifying answers HTTP 400). @typedef {'race' | 'sprint' | 'qualifying'} ResultKind */
/** @type {Record<ResultKind, { path: string, list: string }>} */
const RESULTS = {
  race: { path: 'results', list: 'Results' },
  sprint: { path: 'sprint', list: 'SprintResults' },
  qualifying: { path: 'qualifying', list: 'QualifyingResults' },
};

/** @param {number} season @param {number} round @param {ResultKind} kind */
export const resultsUrl = (season, round, kind) => `${JOLPICA}/${season}/${round}/${RESULTS[kind].path}.json?limit=100`;
/** @param {number} season @param {StandingsKind} kind */
export const standingsUrl = (season, kind) =>
  `${JOLPICA}/${season}/${kind === 'drivers' ? 'driverstandings' : 'constructorstandings'}.json?limit=100`;

/**
 * The sessions of a Jolpica race in weekend order: where Jolpica keeps each (the race's own date and time for the
 * race), our slug, kind and name, OpenF1's session_name (lower case), and the length used while no end is known.
 * @type {{ keys: string[], slug: string, kind: SessionKind, name: string, openF1: string[], minutes: number }[]}
 */
const SESSIONS = [
  { keys: ['FirstPractice'], slug: 'fp1', kind: 'practice', name: 'Practice 1', openF1: ['practice 1'], minutes: 60 },
  { keys: ['SecondPractice'], slug: 'fp2', kind: 'practice', name: 'Practice 2', openF1: ['practice 2'], minutes: 60 },
  { keys: ['ThirdPractice'], slug: 'fp3', kind: 'practice', name: 'Practice 3', openF1: ['practice 3'], minutes: 60 },
  {
    keys: ['SprintQualifying', 'SprintShootout'],
    slug: 'sprint-qualifying',
    kind: 'sprint-qualifying',
    name: 'Sprint Qualifying',
    openF1: ['sprint qualifying', 'sprint shootout'],
    minutes: 60,
  },
  { keys: ['Sprint'], slug: 'sprint', kind: 'sprint', name: 'Sprint', openF1: ['sprint'], minutes: 60 },
  { keys: ['Qualifying'], slug: 'qualifying', kind: 'qualifying', name: 'Qualifying', openF1: ['qualifying'], minutes: 60 },
  { keys: [], slug: 'race', kind: 'race', name: 'Race', openF1: ['race'], minutes: 120 },
];

// Shape checks: every path the parsers read is checked, and a miss is a ShapeError naming the path.

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {unknown} v @param {string} path */
function rec(v, path) {
  if (!isRecord(v)) throw new ShapeError(SRC, `${path} is missing or not an object`);
  return v;
}

/** @param {unknown} v @param {string} path @returns {unknown[]} */
function list(v, path) {
  if (!Array.isArray(v)) throw new ShapeError(SRC, `${path} is missing or not a list`);
  return v;
}

/** @param {unknown} v @param {string} path */
function text(v, path) {
  if (typeof v !== 'string' || v.trim() === '') throw new ShapeError(SRC, `${path} is missing or not text`);
  return v.trim();
}

/** @param {unknown} v */
const optText = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** @param {string} value @param {string} path */
function utc(value, path) {
  try {
    return toUtc(value);
  } catch {
    throw new ShapeError(SRC, `${path} is not a date: ${value}`);
  }
}

/** @param {string} body @param {string} url @returns {unknown} */
function parseJson(body, url) {
  try {
    return JSON.parse(body);
  } catch {
    throw new ShapeError(SRC, `the answer from ${url} is not JSON`);
  }
}

/** Jolpica's MRData of an answer. @param {unknown} json */
const mrData = (json) => rec(rec(json, 'the Jolpica answer').MRData, 'MRData');

/** The races of a Jolpica answer (schedule or results). @param {unknown} json */
const racesOf = (json) => list(rec(mrData(json).RaceTable, 'MRData.RaceTable').Races, 'MRData.RaceTable.Races');

/**
 * A Jolpica date and time ({ date: "2026-11-22", time: "04:00:00Z" }, always UTC) as a UTC instant, or the date alone
 * when Jolpica has no time yet.
 * @param {Record<string, unknown>} o @param {string} path
 * @returns {{ utc: string | null, date: string }}
 */
function jolpicaTime(o, path) {
  const date = text(o.date, `${path}.date`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new ShapeError(SRC, `${path}.date is not a date: ${date}`);
  const time = optText(o.time);
  if (!time) return { utc: null, date };
  return { utc: utc(`${date}T${/(Z|[+-]\d\d:?\d\d)$/i.test(time) ? time : `${time}Z`}`, `${path}.time`), date };
}

/**
 * A session as OpenF1 lists it, reduced to what the calendar takes from it.
 * @typedef {{ name: string, startUtc: string, endUtc: string | null, cancelled: boolean, circuitKey: string | null }} OpenF1Session
 */

/**
 * OpenF1's sessions answer (a list of sessions) for the merge; a ShapeError when it is another shape.
 * @param {unknown} json @returns {OpenF1Session[]}
 */
export function parseOpenF1Sessions(json) {
  return list(json, 'the OpenF1 sessions answer').map((v, i) => {
    const at = `OpenF1 sessions[${i}]`;
    const s = rec(v, at);
    const end = optText(s.date_end);
    return {
      name: text(s.session_name, `${at}.session_name`),
      startUtc: utc(text(s.date_start, `${at}.date_start`), `${at}.date_start`),
      endUtc: end ? utc(end, `${at}.date_end`) : null,
      cancelled: s.is_cancelled === true,
      circuitKey: findCircuit(optText(s.circuit_short_name), optText(s.location), optText(s.country_name))?.key ?? null,
    };
  });
}

/**
 * Jolpica's season schedule as rounds. With OpenF1's sessions, each session takes its end and its cancelled flag from
 * the OpenF1 session of the same weekend (the same circuit, within four days of the race) and name; without them, the
 * ends are placeholders (practice, qualifying and sprint 60 minutes, the race 120). Times come from the UTC timestamp
 * only, the local date from the circuit's zone (Las Vegas: "2026-11-22" at 04:00Z is Saturday the 21st there).
 * @param {unknown} json @param {Date} now @param {OpenF1Session[] | null} [openF1]
 * @returns {Round[]}
 */
export function parseSchedule(json, now, openF1 = null) {
  const races = racesOf(json);
  const read = { url: optText(mrData(json).url) ?? JOLPICA, fetchedAt: now.toISOString() };
  return races.map((v, i) => parseRace(v, `MRData.RaceTable.Races[${i}]`, now, openF1, read)).sort((a, b) => a.round - b.round);
}

/**
 * @param {unknown} v @param {string} at @param {Date} now @param {OpenF1Session[] | null} openF1
 * @param {{ url: string, fetchedAt: string }} read
 * @returns {Round}
 */
function parseRace(v, at, now, openF1, read) {
  const r = rec(v, at);
  const round = num(r.round);
  if (round === null || !Number.isInteger(round)) throw new ShapeError(SRC, `${at}.round is not a round number`);
  const name = text(r.raceName, `${at}.raceName`);
  const circuit = rec(r.Circuit, `${at}.Circuit`);
  const circuitId = text(circuit.circuitId, `${at}.Circuit.circuitId`);
  const location = rec(circuit.Location, `${at}.Circuit.Location`);
  const locality = optText(location.locality);
  const c = findCircuit(circuitId, locality, name);
  if (!c) throw new ShapeError(SRC, `round ${round}: the circuit "${circuitId}" (${locality ?? 'no locality'}, ${name}) is not in circuits.mjs`);

  const race = jolpicaTime(r, at);
  const raceMs = Date.parse(race.utc ?? `${race.date}T12:00:00Z`);
  const weekend = (openF1 ?? []).filter(
    (s) => (s.circuitKey === null || s.circuitKey === c.key) && Math.abs(Date.parse(s.startUtc) - raceMs) <= 4 * DAY_MS,
  );

  /** @type {Session[]} */
  const sessions = [];
  for (const def of SESSIONS) {
    const key = def.keys.find((k) => r[k] !== undefined);
    if (def.slug !== 'race' && key === undefined) continue;
    const when = key === undefined ? race : jolpicaTime(rec(r[key], `${at}.${key}`), `${at}.${key}`);
    const o = weekend.find((s) => def.openF1.includes(s.name.toLowerCase()));
    /** @type {Session['timeConfidence']} */
    let timeConfidence = 'confirmed';
    let startUtc = when.utc;
    if (startUtc === null && o) startUtc = o.startUtc;
    if (startUtc === null) {
      // no time yet anywhere: midday on Jolpica's date, marked as not known
      startUtc = localToUtc(`${when.date}T12:00:00`, c.timeZone);
      timeConfidence = 'tbc';
    }
    // OpenF1's end only when its start is the same session's (a moved session keeps the placeholder)
    const sameStart = o !== undefined && Math.abs(Date.parse(o.startUtc) - Date.parse(startUtc)) <= 15 * 60_000;
    const endUtc = sameStart && o.endUtc && Date.parse(o.endUtc) > Date.parse(startUtc) ? o.endUtc : addMinutes(startUtc, def.minutes);
    sessions.push({
      id: sessionId(round, def.slug),
      kind: def.kind,
      name: def.name,
      startUtc,
      endUtc,
      localDate: timeConfidence === 'tbc' ? when.date : localDateOf(startUtc, c.timeZone),
      timeConfidence,
      status: statusAt({ startUtc, endUtc }, now, o?.cancelled === true),
      resultsState: 'none',
    });
  }
  sessions.sort((a, b) => a.startUtc.localeCompare(b.startUtc));

  return {
    round,
    name,
    circuitName: optText(circuit.circuitName) ?? c.city,
    city: c.city,
    country: c.country,
    countryCode: c.countryCode,
    timeZone: c.timeZone,
    circuitKey: c.key,
    lat: num(location.lat),
    long: num(location.long),
    ...roundSpan(sessions, c.timeZone, now, { startDate: race.date, endDate: race.date }),
    source: { name: weekend.length > 0 ? NAME_WITH_OPENF1 : NAME, ...read },
    sessions,
  };
}

/** The Jolpica classification of a session kind, or null (practice, sprint qualifying: Jolpica keeps none). @param {SessionKind} kind */
const resultKindOf = (kind) => (kind === 'race' || kind === 'sprint' || kind === 'qualifying' ? kind : null);

/**
 * One Jolpica classification (race, sprint or qualifying) as a ResultDoc, or null while Jolpica has none (an empty
 * Races list). `round`, when given, must be the round the answer is about. The state is always provisional: the sync
 * decides when a result is final.
 * @param {unknown} json @param {ResultKind} kind @param {{ url: string, fetchedAt: string, round?: number }} o
 * @returns {ResultDoc | null}
 */
export function parseResults(json, kind, o) {
  const races = racesOf(json);
  if (races.length === 0) return null;
  const at = 'MRData.RaceTable.Races[0]';
  const race = rec(races[0], at);
  if (o.round !== undefined && num(race.round) !== o.round) {
    throw new ShapeError(SRC, `asked for round ${o.round}, the answer is round ${String(race.round)}`);
  }
  const key = RESULTS[kind].list;
  const entries = list(race[key], `${at}.${key}`);
  if (entries.length === 0) return null;
  const rows = entries.map((v, i) => resultRow(v, kind, `${at}.${key}[${i}]`));
  return { state: 'provisional', fetchedAt: o.fetchedAt, rows, source: { name: NAME, url: o.url } };
}

/** @param {unknown} v @param {ResultKind} kind @param {string} at @returns {ResultRow} */
function resultRow(v, kind, at) {
  const e = rec(v, at);
  const driver = rec(e.Driver, `${at}.Driver`);
  const team = text(rec(e.Constructor, `${at}.Constructor`).name, `${at}.Constructor.name`);
  const driverName = [optText(driver.givenName), optText(driver.familyName)].filter(Boolean).join(' ');
  if (!driverName) throw new ShapeError(SRC, `${at}.Driver has no name`);
  const carNumber = optText(e.number);
  const driverCode = optText(driver.code);
  if (kind === 'qualifying') {
    return {
      position: num(e.position),
      ...(carNumber ? { carNumber } : {}),
      ...(driverCode ? { driverCode } : {}),
      driverName,
      team,
      // the time of the last part the driver reached
      timeOrGap: optText(e.Q3) ?? optText(e.Q2) ?? optText(e.Q1) ?? '',
    };
  }
  // positionText is "R", "D", "W" and the like for an unclassified car: no position then
  const position = e.positionText !== undefined ? num(e.positionText) : num(e.position);
  const points = num(e.points);
  const laps = num(e.laps);
  return {
    position,
    ...(carNumber ? { carNumber } : {}),
    ...(driverCode ? { driverCode } : {}),
    driverName,
    team,
    timeOrGap: optText(isRecord(e.Time) ? e.Time.time : null) ?? optText(e.status) ?? '',
    ...(points !== null ? { points } : {}),
    ...(laps !== null ? { laps } : {}),
  };
}

/**
 * A Jolpica standings answer (driverstandings or constructorstandings) as a StandingsDoc, or null while the season has
 * none (an empty StandingsLists).
 * @param {unknown} json @param {StandingsKind} kind @returns {StandingsDoc | null}
 */
export function parseStandings(json, kind) {
  const lists = list(rec(mrData(json).StandingsTable, 'MRData.StandingsTable').StandingsLists, 'MRData.StandingsTable.StandingsLists');
  if (lists.length === 0) return null;
  const at = 'MRData.StandingsTable.StandingsLists[0]';
  const l = rec(lists[0], at);
  const afterRound = num(l.round);
  if (afterRound === null) throw new ShapeError(SRC, `${at}.round is not a round number`);
  const key = kind === 'drivers' ? 'DriverStandings' : 'ConstructorStandings';
  const entries = list(l[key], `${at}.${key}`);
  if (entries.length === 0) return null;
  const rows = entries.map((v, i) => {
    const p = `${at}.${key}[${i}]`;
    const e = rec(v, p);
    const points = num(e.points);
    if (points === null) throw new ShapeError(SRC, `${p}.points is not a number`);
    const position = num(e.position) ?? num(e.positionText) ?? i + 1;
    if (kind === 'teams') return { position, name: text(rec(e.Constructor, `${p}.Constructor`).name, `${p}.Constructor.name`), points };
    const driver = rec(e.Driver, `${p}.Driver`);
    const name = [optText(driver.givenName), optText(driver.familyName)].filter(Boolean).join(' ');
    if (!name) throw new ShapeError(SRC, `${p}.Driver has no name`);
    // the team the driver drove for last
    const teams = list(e.Constructors ?? [], `${p}.Constructors`);
    const last = teams.length > 0 ? optText(rec(teams[teams.length - 1], `${p}.Constructors[${teams.length - 1}]`).name) : null;
    return { position, name, ...(last ? { team: last } : {}), points };
  });
  return { kind, afterRound, rows };
}

/**
 * How long after a session's end its results are polled: race and sprint 180 minutes, qualifying and sprint
 * qualifying 60, practice none (Jolpica keeps no practice classification).
 * @param {Session} session
 */
export function resultsWindowMinutes(session) {
  switch (session.kind) {
    case 'race':
    case 'sprint':
      return 180;
    case 'qualifying':
    case 'sprint-qualifying':
      return 60;
    default:
      return 0;
  }
}

/**
 * OpenF1's sessions of the season, or null when OpenF1 does not give them: any status but 200 (401 while a session is
 * live), a network error, another shape, or an empty year. Only the caller's abort goes through.
 * @param {number} season @param {SourceDeps} deps
 */
async function readOpenF1(season, deps) {
  try {
    const r = await deps.get(openF1SessionsUrl(season), JSON_ACCEPT);
    if (r.status !== 200) return null;
    const sessions = parseOpenF1Sessions(parseJson(r.text, r.url));
    return sessions.length > 0 ? sessions : null;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return null;
  }
}

/** @param {number} season @param {StandingsKind} kind @param {SourceDeps} deps */
async function readStandings(season, kind, deps) {
  const url = standingsUrl(season, kind);
  const body = okText(await deps.get(url, JSON_ACCEPT), SRC);
  return body === null ? null : parseStandings(parseJson(body, url), kind);
}

/** @type {import('../source.mjs').Source} */
export const source = {
  series: 'f1',
  name: NAME,

  async calendar(season, deps) {
    const url = scheduleUrl(season);
    const body = okText(await deps.get(url, JSON_ACCEPT), SRC);
    if (body === null) return null;
    const json = parseJson(body, url);
    // an empty season (2027 before its schedule is out: "total": "0") is not published: OpenF1 is not asked then
    if (racesOf(json).length === 0) return null;
    const openF1 = await readOpenF1(season, deps);
    return parseSchedule(json, deps.now(), openF1);
  },

  async results(season, round, session, deps) {
    const kind = resultKindOf(session.kind);
    if (!kind) return null;
    const url = resultsUrl(season, round.round, kind);
    const body = okText(await deps.get(url, JSON_ACCEPT), SRC);
    if (body === null) return null;
    return parseResults(parseJson(body, url), kind, { url, fetchedAt: deps.now().toISOString(), round: round.round });
  },

  async standings(season, deps) {
    const drivers = await readStandings(season, 'drivers', deps);
    const teams = await readStandings(season, 'teams', deps);
    return { drivers, teams };
  },

  resultsWindowMinutes,
};
