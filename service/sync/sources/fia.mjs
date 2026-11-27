// Formula 2 and Formula 3 (RW.RESEARCH 1.4): the series' own sites, fiaformula2.com and fiaformula3.com, read by one
// parser. The season page lists the rounds (the series' own round numbers and each round page's slug); each round page
// carries the meeting and its sessions in the Next.js flight data (the self.__next_f.push chunks), with local times
// and offsets that are right, and the latest race's classification beside its session. The standings are the HTML
// tables of /en/standings/{year}/drivers and /teams. api.formula1.com, which the pages call with a key of their own,
// is never read, and nothing here goes near an AI model (decision D3).

import { findCircuit } from '../circuits.mjs';
import { ShapeError } from '../http.mjs';
import { num, roundSpan, sessionId, statusAt, textOf } from '../source.mjs';
import { offsetToUtc } from '../time.mjs';

/** @typedef {import('../source.mjs').Round} Round */
/** @typedef {import('../source.mjs').Session} Session */
/** @typedef {import('../source.mjs').SessionKind} SessionKind */
/** @typedef {import('../source.mjs').ResultDoc} ResultDoc */
/** @typedef {import('../source.mjs').ResultRow} ResultRow */
/** @typedef {import('../source.mjs').StandingsDoc} StandingsDoc */
/** @typedef {import('../source.mjs').SourceDeps} SourceDeps */
/** @typedef {import('../source.mjs').Source} Source */
/** @typedef {import('../../../src/lib/raceData.ts').StandingsKind} StandingsKind */

/** @typedef {'f2' | 'f3'} FiaSeries */

/**
 * One of the two sites.
 * @typedef {object} FiaSite
 * @property {FiaSeries} series
 * @property {string} host The site's origin, no slash at the end.
 * @property {string} name The source as the app credits it.
 * @property {Record<number, string[]>} slugs Per season, the round pages' slugs in round order (RW.RESEARCH 1.4): the
 *   round list when the season page cannot be read.
 */

/** @type {Record<FiaSeries, FiaSite>} */
export const SITES = {
  f2: {
    series: 'f2',
    host: 'https://www.fiaformula2.com',
    name: 'FIA Formula 2 (fiaformula2.com)',
    slugs: {
      2026: ['melbourne', 'miami-gardens', 'montreal', 'monte-carlo', 'barcelona', 'spielberg', 'silverstone', 'spa-francorchamps', 'budapest', 'monza', 'madrid', 'baku', 'lusail', 'yas-marina'],
    },
  },
  f3: {
    series: 'f3',
    host: 'https://www.fiaformula3.com',
    name: 'FIA Formula 3 (fiaformula3.com)',
    slugs: {
      2026: ['melbourne', 'monte-carlo', 'barcelona', 'spielberg', 'silverstone', 'spa-francorchamps', 'budapest', 'monza', 'madrid'],
    },
  },
};

const HTML_ACCEPT = { accept: 'text/html' };

/** @param {FiaSite} site @param {number} season */
export const seasonUrl = (site, season) => `${site.host}/en/racing/${season}`;
/** @param {FiaSite} site @param {number} season @param {string} slug */
export const roundUrl = (site, season, slug) => `${site.host}/en/racing/${season}/${slug}`;
/** @param {FiaSite} site @param {number} season @param {StandingsKind} kind */
export const standingsUrl = (site, season, kind) => `${site.host}/en/standings/${season}/${kind}`;

/** The sites answer a page they do not have with this text (as an HTTP 500 for /en/racing/2027). @param {string} html */
export const isNotFoundPage = (html) => /couldn(?:'|&#x27;|&#39;|\u2019)t find the page/i.test(html);

// ---------- small readers of unknown JSON ----------

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {unknown} v @param {string} at @param {string} src @returns {Record<string, unknown>} */
function rec(v, at, src) {
  if (!isRecord(v)) throw new ShapeError(src, `${at} is not an object`);
  return v;
}

/** @param {unknown} v @param {string} at @param {string} src @returns {unknown[]} */
function list(v, at, src) {
  if (!Array.isArray(v)) throw new ShapeError(src, `${at} is not a list`);
  return v;
}

/**
 * A flight value's text, or null: a string that starts with "$" is a reference ("$undefined", "$L7a"), not text, and
 * "$$" stands for a "$".
 * @param {unknown} v
 */
function optText(v) {
  if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  if (typeof v !== 'string') return null;
  const s = v.startsWith('$$') ? v.slice(1) : v.startsWith('$') ? '' : v;
  const t = s.trim();
  return t === '' ? null : t;
}

/** @param {unknown} v @param {string} at @param {string} src */
function text(v, at, src) {
  const t = optText(v);
  if (t === null) throw new ShapeError(src, `${at} is missing`);
  return t;
}

// ---------- the flight data of a round page ----------

const PUSH = /<script\b[^>]*>\s*self\.__next_f\.push\((\[[\s\S]*?\])\)\s*;?\s*<\/script>/g;
const BACKSLASH = String.fromCharCode(92);

/**
 * The Next.js flight text of an App Router page: the strings of every self.__next_f.push([1, "..."]) chunk, in order
 * (a row may be split over two chunks).
 * @param {string} html
 */
export function nextFlightText(html) {
  let out = '';
  for (const m of html.matchAll(PUSH)) {
    /** @type {unknown} */
    let chunk;
    try {
      chunk = JSON.parse(m[1]);
    } catch {
      continue;
    }
    if (Array.isArray(chunk) && chunk[0] === 1 && typeof chunk[1] === 'string') out += chunk[1];
  }
  return out;
}

/**
 * The JSON text of the object or list that opens at `from`, strings and escapes heeded; null when it never closes.
 * @param {string} text @param {number} from
 */
function balancedJson(text, from) {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = from; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === BACKSLASH) escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') depth++;
    else if (c === '}' || c === ']') {
      depth--;
      if (depth === 0) return text.slice(from, i + 1);
    }
  }
  return null;
}

/**
 * Where the object around `at` opens, or -1: scanned from the start of its flight row (one line; a JSON string never
 * holds a raw line break).
 * @param {string} text @param {number} at
 */
function openingBrace(text, at) {
  if (text[at - 1] === '{') return at - 1;
  /** @type {number[]} */
  const open = [];
  let inString = false;
  let escaped = false;
  for (let i = text.lastIndexOf('\n', at) + 1; i < at; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === BACKSLASH) escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{' || c === '[') open.push(i);
    else if (c === '}' || c === ']') open.pop();
  }
  const top = open[open.length - 1];
  return top !== undefined && text[top] === '{' ? top : -1;
}

/**
 * The meeting object of a round page's flight data: the one holding "meetingSessions" (the meeting's fields and its
 * sessions, each with its results while it is the latest race).
 * @param {string} html @param {string} [src]
 * @returns {Record<string, unknown>}
 */
export function parseMeeting(html, src = 'f2/f3') {
  const text = nextFlightText(html);
  const key = '"meetingSessions":';
  for (let at = text.indexOf(key); at >= 0; at = text.indexOf(key, at + key.length)) {
    const open = openingBrace(text, at);
    if (open < 0) continue;
    const json = balancedJson(text, open);
    if (json === null) continue;
    try {
      const v = JSON.parse(json);
      if (isRecord(v) && Array.isArray(v.meetingSessions)) return v;
    } catch {
      // not this one
    }
  }
  throw new ShapeError(src, 'no meeting with its sessions in the page');
}

// ---------- round pages ----------

/** @param {string} type @param {string} name @returns {{ base: string, kind: SessionKind } | null} */
function sessionBase(type, name) {
  const t = type.toLowerCase();
  const n = name.toLowerCase();
  if (t === 'practice' || (t === '' && n.includes('practice'))) return { base: 'practice', kind: 'practice' };
  if (t === 'qualifying' || (t === '' && n.includes('qualifying'))) return { base: 'qualifying', kind: 'qualifying' };
  if (t === 'race' || (t === '' && n.includes('race'))) return n.includes('sprint') ? { base: 'sprint', kind: 'sprint' } : { base: 'feature', kind: 'race' };
  return null;
}

/**
 * Each session's slug: its base (practice, qualifying, sprint, feature), and when the round has two of a base, the
 * last word of their names ("Qualifying A": qualifying-a, "Feature Race 2": feature-2) or else their order.
 * @param {{ base: string, name: string }[]} sessions
 */
function slugsOf(sessions) {
  /** @type {Map<string, number[]>} */
  const groups = new Map();
  sessions.forEach((s, i) => groups.set(s.base, [...(groups.get(s.base) ?? []), i]));
  const slugs = sessions.map((s) => s.base);
  for (const [base, members] of groups) {
    if (members.length < 2) continue;
    const tokens = members.map((i) => (sessions[i].name.toLowerCase().split(/\s+/).pop() ?? '').replace(/[^a-z0-9]/g, ''));
    const usable = tokens.every((t) => /^(?:[a-z]|\d+)$/.test(t)) && new Set(tokens).size === tokens.length;
    members.forEach((i, k) => (slugs[i] = `${base}-${usable ? tokens[k] : k + 1}`));
  }
  return slugs;
}

/** A printed local time, checked. @param {unknown} v @param {string} at @param {string} src */
function localTime(v, at, src) {
  const t = text(v, at, src);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(t)) throw new ShapeError(src, `${at} is not a local time: ${t}`);
  return t;
}

/** @param {string} local @param {string} offset @param {string} at @param {string} src */
function utcOf(local, offset, at, src) {
  try {
    return offsetToUtc(local, offset);
  } catch {
    throw new ShapeError(src, `${at} has no usable offset: ${local} ${offset}`);
  }
}

/** One classified car, from a session's results. @param {unknown} v @param {string} at @param {string} src @returns {ResultRow} */
function resultRow(v, at, src) {
  const e = rec(v, at, src);
  const driverName = [optText(e.driverFirstName), optText(e.driverLastName)].filter(Boolean).join(' ') || optText(e.driverShortName);
  if (!driverName) throw new ShapeError(src, `${at} has no driver name`);
  const carNumber = optText(e.racingNumber);
  const driverCode = optText(e.driverTLA);
  const points = num(e.racePoints);
  const laps = num(e.lapsCompleted);
  return {
    // positionValue is "" for a car not classified (its positionNumber is then "666")
    position: num(e.positionValue),
    ...(carNumber ? { carNumber } : {}),
    ...(driverCode ? { driverCode } : {}),
    driverName,
    team: optText(e.teamName) ?? optText(e.displayTeamName) ?? '',
    timeOrGap: optText(e.displayTime) ?? optText(e.raceTime) ?? optText(e.displayPosition) ?? '',
    ...(points !== null ? { points } : {}),
    ...(laps !== null ? { laps } : {}),
  };
}

/**
 * What a round page holds: the round (with `round` as the series' own number, from the season page), the F1 round of
 * the weekend (meetingNumber), and the rows of each session the page classifies, by session id.
 * @typedef {{ round: Round, f1Round: number | null, results: Map<string, ResultRow[]> }} RoundPage
 */

/**
 * A round page. UTC is each printed local time minus its own offset (gmtOffset: right on these sites); the zone and
 * the circuit key come from our circuit table (by the page's slug, its location, the circuit's name), else from the
 * page's own IANA zone without a key. A start at midnight is the sites' placeholder for a time not yet set.
 * @param {string} html
 * @param {{ site: FiaSite, round: number, url: string, now: Date, season?: number }} o
 * @returns {RoundPage}
 */
export function parseRoundPage(html, o) {
  const src = o.site.series;
  const meeting = parseMeeting(html, src);
  if (o.season !== undefined && num(optText(meeting.season)) !== null && num(optText(meeting.season)) !== o.season) {
    throw new ShapeError(src, `${o.url} is about season ${String(meeting.season)}, not ${o.season}`);
  }
  const raw = list(meeting.meetingSessions, 'meetingSessions', src).map((v, i) => ({ s: rec(v, `meetingSessions[${i}]`, src), i }));

  const slug = (optText(meeting.url) ?? o.url).replace(/[?#].*$/, '').replace(/\/+$/, '').split('/').pop() ?? '';
  const circuit = findCircuit(
    slug.replace(/-/g, ' '),
    optText(meeting.circuitLocation),
    optText(meeting.meetingLocation),
    optText(meeting.circuitOfficialName),
    optText(meeting.circuitShortName),
  );
  const timeZone = circuit?.timeZone ?? raw.map(({ s }) => optText(s.timezone)).find(Boolean) ?? optText(meeting.meetingTimezone);
  if (!timeZone) throw new ShapeError(src, `${o.url}: no circuit in our table and no time zone in the page`);

  const known = raw.flatMap(({ s, i }) => {
    const name = optText(s.shortName) ?? optText(s.session) ?? optText(s.text) ?? '';
    const base = sessionBase(optText(s.sessionType) ?? optText(s.description) ?? '', name);
    return base ? [{ s, i, name, ...base }] : [];
  });
  const slugs = slugsOf(known);
  const now = o.now;
  /** @type {Map<string, ResultRow[]>} */
  const results = new Map();
  /** @type {Session[]} */
  const sessions = known.map((k, n) => {
    const at = `meetingSessions[${k.i}]`;
    const start = localTime(k.s.startTime, `${at}.startTime`, src);
    const offset = text(k.s.gmtOffset, `${at}.gmtOffset`, src);
    const end = optText(k.s.endTime);
    const startUtc = utcOf(start, offset, at, src);
    const endUtc = end ? utcOf(localTime(end, `${at}.endTime`, src), offset, at, src) : null;
    const id = sessionId(o.round, slugs[n]);
    const rows = Array.isArray(k.s.results) ? k.s.results.map((r, j) => resultRow(r, `${at}.results[${j}]`, src)) : [];
    if (rows.length > 0) results.set(id, rows);
    return {
      id,
      kind: k.kind,
      name: k.name,
      startUtc,
      endUtc,
      localDate: start.slice(0, 10),
      timeConfidence: /T00:00(?::00)?$/.test(start) ? 'placeholder' : 'confirmed',
      status: statusAt({ startUtc, endUtc }, now, /cancel/i.test(optText(k.s.state) ?? '')),
      resultsState: 'none',
    };
  });

  const f1Round = num(optText(meeting.meetingNumber));
  const fallback = { startDate: optText(meeting.meetingStartDate)?.slice(0, 10) ?? '', endDate: optText(meeting.meetingEndDate)?.slice(0, 10) ?? '' };
  /** @type {Round} */
  const round = {
    round: o.round,
    name: text(meeting.meetingName, 'meetingName', src),
    circuitName: optText(meeting.circuitOfficialName) ?? optText(meeting.circuitShortName) ?? '',
    city: circuit?.city ?? optText(meeting.circuitLocation) ?? optText(meeting.meetingLocation) ?? '',
    country: circuit?.country ?? optText(meeting.meetingIsoCountryName) ?? optText(meeting.meetingCountryName) ?? '',
    countryCode: circuit?.countryCode ?? '',
    timeZone,
    ...(circuit ? { circuitKey: circuit.key } : {}),
    lat: null,
    long: null,
    ...roundSpan(sessions, timeZone, now, fallback),
    ...(f1Round !== null ? { sharedWith: [{ series: /** @type {const} */ ('f1'), round: f1Round }] } : {}),
    source: { name: o.site.name, url: o.url, fetchedAt: now.toISOString() },
    sessions,
  };
  return { round, f1Round, results };
}

// ---------- the season page ----------

/**
 * The season page's rounds: each card's "ROUND n" and the round page it links to (/en/racing/{season}/{slug}), in round
 * order. Empty when the page names none.
 * @param {string} html @param {number} season
 * @returns {{ round: number, slug: string }[]}
 */
export function parseSeasonRounds(html, season) {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  const parts = body.split(/>\s*ROUND\s+(\d+)\s*</i);
  const href = new RegExp(`href="(?:https?://[^/"]+)?/en/racing/${season}/([a-z0-9-]+)/?"`, 'i');
  /** @type {Map<number, string>} */
  const rounds = new Map();
  for (let k = 1; k + 1 < parts.length; k += 2) {
    const n = Number(parts[k]);
    const m = href.exec(parts[k + 1]);
    if (m && n > 0 && !rounds.has(n)) rounds.set(n, m[1].toLowerCase());
  }
  return [...rounds].sort((a, b) => a[0] - b[0]).map(([round, slug]) => ({ round, slug }));
}

/**
 * A page's HTML, or null when the site has no such page: a 404, or its "couldn't find the page" (which the sites send
 * as an HTTP 500). Any other answer but a 200 throws.
 * @param {string} url @param {SourceDeps} deps @param {string} src
 */
async function readPage(url, deps, src) {
  const r = await deps.get(url, HTML_ACCEPT);
  if (r.status === 200) return r.text;
  if (r.status === 404 || (r.status >= 500 && isNotFoundPage(r.text))) return null;
  throw new Error(`${src}: HTTP ${r.status} from ${r.url}`);
}

/**
 * The season's rounds and their slugs: from the season page, or from the known list (RW.RESEARCH 1.4) when the page
 * is gone or names no round; null when the season is not published and no list is known.
 * @param {FiaSite} site @param {number} season @param {SourceDeps} deps
 * @returns {Promise<{ round: number, slug: string }[] | null>}
 */
export async function readRoundList(site, season, deps) {
  const url = seasonUrl(site, season);
  const html = await readPage(url, deps, site.series);
  const known = site.slugs[season]?.map((slug, i) => ({ round: i + 1, slug })) ?? null;
  if (html === null) return known;
  const rounds = parseSeasonRounds(html, season);
  if (rounds.length > 0) return rounds;
  if (known) return known;
  if (isNotFoundPage(html)) return null;
  throw new ShapeError(site.series, `no round on ${url}`);
}

// ---------- standings ----------

/**
 * A standings table (/en/standings/{year}/drivers or /teams) as a StandingsDoc, or null while no round has points.
 * The first head row names the rounds, each over as many columns as it has races (grid-column:span n); each body row
 * is the position and name, a cell per race ("-" for one not run) and the total. `afterRound` is the last round any
 * row has a value in.
 * @param {string} html @param {StandingsKind} kind @param {string} [src]
 * @returns {StandingsDoc | null}
 */
export function parseStandingsTable(html, kind, src = 'f2/f3') {
  const table = /<table\b[\s\S]*?<\/table>/i.exec(html)?.[0];
  if (!table) throw new ShapeError(src, `no ${kind} standings table in the page`);
  const head = /<thead\b[\s\S]*?<\/thead>/i.exec(table)?.[0] ?? '';
  const firstRow = /<tr\b[\s\S]*?<\/tr>/i.exec(head)?.[0] ?? '';
  /** @type {number[]} */
  const spans = [];
  for (const m of firstRow.matchAll(/<th\b([^>]*)>([\s\S]*?)<\/th>/gi)) {
    if (!/href="[^"]*\/racing\//i.test(m[2])) continue;
    spans.push(Number(/grid-column:\s*span\s+(\d+)/i.exec(m[1])?.[1] ?? 1));
  }
  if (spans.length === 0) throw new ShapeError(src, `the ${kind} standings table names no round`);
  const columns = spans.reduce((a, b) => a + b, 0);
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/i.exec(table)?.[1];
  if (body === undefined) throw new ShapeError(src, `the ${kind} standings table has no body`);

  let afterRound = 0;
  /** @type {StandingsDoc['rows']} */
  const rows = [];
  for (const tr of body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...tr[1].matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((c) => textOf(c[2]));
    if (cells.length === 0) continue;
    const at = `${kind} standings row ${rows.length + 1}`;
    if (cells.length !== columns + 2) throw new ShapeError(src, `${at} has ${cells.length} cells, the head ${columns + 2}`);
    const label = /^(\d+)?\s*(.*)$/.exec(cells[0]);
    const name = label?.[2].trim() ?? '';
    const points = num(cells[cells.length - 1]);
    if (!name || points === null) throw new ShapeError(src, `${at} has no name or no points`);
    let col = 1;
    spans.forEach((span, r) => {
      if (cells.slice(col, col + span).some((v) => v !== '' && v !== '-')) afterRound = Math.max(afterRound, r + 1);
      col += span;
    });
    rows.push({ position: num(label?.[1]) ?? rows.length + 1, name, points });
  }
  if (rows.length === 0 || afterRound === 0) return null;
  return { kind, afterRound, rows };
}

// ---------- the sources ----------

/**
 * How long after a session's end its results are polled: 30 minutes, practice none (the pages classify no practice).
 * @param {Session} session
 */
export const resultsWindowMinutes = (session) => (session.kind === 'practice' ? 0 : 30);

/**
 * The round page of a stored round: its source URL, or the season's round list when that is not one of ours.
 * @param {FiaSite} site @param {number} season @param {Round} round @param {SourceDeps} deps
 */
async function roundPageUrl(site, season, round, deps) {
  const url = round.source?.url ?? '';
  if (url.startsWith(`${site.host}/en/racing/${season}/`)) return url;
  const rounds = await readRoundList(site, season, deps);
  const hit = rounds?.find((r) => r.round === round.round);
  return hit ? roundUrl(site, season, hit.slug) : null;
}

/**
 * The source of one of the two sites.
 * @param {FiaSite} site
 * @returns {Source}
 */
export function fiaSource(site) {
  const src = site.series;
  return {
    series: site.series,
    name: site.name,

    async calendar(season, deps) {
      const list = await readRoundList(site, season, deps);
      if (!list || list.length === 0) return null;
      const now = deps.now();
      /** @type {Round[]} */
      const rounds = [];
      for (const { round, slug } of list) {
        const url = roundUrl(site, season, slug);
        const html = await readPage(url, deps, src);
        if (html === null) throw new ShapeError(src, `round ${round} has no page at ${url}`);
        rounds.push(parseRoundPage(html, { site, season, round, url, now }).round);
      }
      return rounds;
    },

    async results(season, round, session, deps) {
      const url = await roundPageUrl(site, season, round, deps);
      if (!url) return null;
      const html = await readPage(url, deps, src);
      if (html === null) return null;
      const now = deps.now();
      const rows = parseRoundPage(html, { site, season, round: round.round, url, now }).results.get(session.id);
      if (!rows || rows.length === 0) return null;
      return { state: 'provisional', fetchedAt: now.toISOString(), rows, source: { name: site.name, url } };
    },

    async standings(season, deps) {
      /** @param {StandingsKind} kind */
      const read = async (kind) => {
        const html = await readPage(standingsUrl(site, season, kind), deps, src);
        return html === null ? null : parseStandingsTable(html, kind, src);
      };
      const drivers = await read('drivers');
      const teams = await read('teams');
      return { drivers, teams };
    },

    resultsWindowMinutes,
  };
}

/** @type {import('../source.mjs').Source} */
export const f2Source = fiaSource(SITES.f2);

/** @type {import('../source.mjs').Source} */
export const f3Source = fiaSource(SITES.f3);
