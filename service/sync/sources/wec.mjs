// FIA WEC (RW.RESEARCH 1.8). fiawec.com is the one source, read as HTML and iCalendar:
//   the season page (/en/season/{year}) lists the rounds (its race list; while a season has no race list yet, its
//     season overview), and its standings selector gives each round's race id;
//   each round's ICS (/en/race/calendar/{raceId}) gives the sessions. It carries TZID local times with no VTIMEZONE
//     (time.mjs turns them into UTC), and Le Mans writes its local clock with a "Z" (the race at "16:00Z" starts at
//     16:00 in Le Mans), so a "Z" or a floating time is read as the circuit's clock;
//   a round whose ICS is a 404 (2027 before the times are out) takes its programme from its race page: a session with
//     a date only is a 'tbc' session at the circuit's midday, one with a timestamp is confirmed; a round with neither
//     keeps the season overview's race day and no sessions;
//   the results page (/en/page/resultats-1?raceId=&sessionId=) gives one session's classification, the Hypercar
//     class only; the classification page (/en/page/manufacturers-classification) gives the Hypercar standings and
//     the crews (each car's season drivers, which the results page does not print).
// When the results or the standings no longer parse (a ShapeError) and the user set a key, the AI repair step
// (deps.repair, service/sync/ai.mjs) reads the page's text; its answer is validated as strictly as a parse, and nothing
// here calls a model itself (RW.RESEARCH 1.8 and 9.4).

import { CIRCUITS, findCircuit } from '../circuits.mjs';
import { ShapeError, okText } from '../http.mjs';
import { decodeEntities, num, roundSpan, sessionId, statusAt, textOf } from '../source.mjs';
import { localDateOf, localToUtc } from '../time.mjs';

/** @typedef {import('../source.mjs').Round} Round */
/** @typedef {import('../source.mjs').Session} Session */
/** @typedef {import('../source.mjs').SessionKind} SessionKind */
/** @typedef {import('../source.mjs').ResultDoc} ResultDoc */
/** @typedef {import('../source.mjs').ResultRow} ResultRow */
/** @typedef {import('../source.mjs').StandingsDoc} StandingsDoc */
/** @typedef {import('../source.mjs').SourceDeps} SourceDeps */
/** @typedef {import('../circuits.mjs').Circuit} Circuit */
/** @typedef {import('../../../src/lib/raceData.ts').SessionClass} SessionClass */
/** @typedef {import('../../../src/lib/raceData.ts').TimeConfidence} TimeConfidence */
/** @typedef {import('../../../src/lib/raceData.ts').StandingsKind} StandingsKind */

export const NAME = 'FIA WEC (fiawec.com)';
const SRC = 'wec';
const BASE = 'https://www.fiawec.com';
const HTML = { accept: 'text/html' };

/** The most text the AI repair step is given. */
export const REPAIR_MAX = 30_000;

/** @param {number} season */
export const seasonUrl = (season) => `${BASE}/en/season/${season}`;
/** @param {number} raceId */
export const icsUrl = (raceId) => `${BASE}/en/race/calendar/${raceId}`;
/** @param {string} slug */
export const racePageUrl = (slug) => `${BASE}/en/race/${slug}`;
/** @param {number} raceId @param {number} [session] the site's session id; without it, the page shows the latest */
export const resultsUrl = (raceId, session) => `${BASE}/en/page/resultats-1?raceId=${raceId}${session === undefined ? '' : `&sessionId=${session}`}`;
/** @param {number} [seasonId] the site's season id; without it, the page shows the current season */
export const standingsUrl = (seasonId) => `${BASE}/en/page/manufacturers-classification${seasonId === undefined ? '' : `?season_id=${seasonId}`}`;

/**
 * The race ids as read on 2026-11-27, by race page slug: for a season page whose standings selector gives none (2027
 * before its first race) and for the results of a round read from its race page. A slug missing here costs one more
 * request (its race page's calendar link).
 * @type {Readonly<Record<string, number>>}
 */
export const KNOWN_RACE_IDS = Object.freeze({
  '6-hours-of-imola-2026': 4948,
  'totalenergies-6-hours-of-spa-francorchamps-2026': 4949,
  '24-hours-of-le-mans-2026': 4951,
  'rolex-6-hours-of-sao-paulo-2026': 4952,
  'lone-star-le-mans-2026': 4953,
  '6-hours-of-fuji-2026': 4954,
  '6-hours-of-barcelona-2026': 5065,
  '6-hours-of-monza-2026': 5066,
  'qatar-1812km-2027': 5043,
  '6-hours-of-imola-2027': 5044,
  'totalenergies-6-hours-of-spa-francorchamps-2027': 5045,
  '6-hours-of-fuji-2027': 5046,
  'lone-star-le-mans-2027': 5047,
  'bapco-energies-8-hours-of-bahrain-2027': 5048,
  'rolex-6-hours-of-sao-paulo-2027': 5049,
  '24-hours-of-le-mans-2027': 5051,
  '6-hours-of-silverstone-2027': 5055,
});

/** circuits.mjs keeps no circuit names: the WEC's circuits by key. @type {Readonly<Record<string, string>>} */
const CIRCUIT_NAMES = {
  imola: 'Autodromo Enzo e Dino Ferrari',
  spa: 'Circuit de Spa-Francorchamps',
  le_mans: 'Circuit de la Sarthe',
  interlagos: 'Autodromo Jose Carlos Pace',
  americas: 'Circuit of the Americas',
  fuji: 'Fuji Speedway',
  catalunya: 'Circuit de Barcelona-Catalunya',
  monza: 'Autodromo Nazionale Monza',
  losail: 'Lusail International Circuit',
  bahrain: 'Bahrain International Circuit',
  silverstone: 'Silverstone Circuit',
};

/** Names findCircuit reads wrong: "Lone Star Le Mans" is in Austin, not at Le Mans. @type {[RegExp, string][]} */
const CIRCUIT_OVERRIDES = [[/\blone[\s-]+star\b/i, 'americas']];

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "Mar", "march", "MARCH" as "03", or null. @param {string} word */
function monthOf(word) {
  const i = MONTHS.indexOf(word.slice(0, 3).toLowerCase());
  return i < 0 ? null : String(i + 1).padStart(2, '0');
}

/** @param {unknown} v @returns {v is Record<string, unknown>} */
const isRecord = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

/** @param {SourceDeps} deps @param {string} url @param {{ accept?: string }} [o] */
const getText = async (deps, url, o) => okText(await deps.get(url, o), SRC);

/** The first flag's country code ("flag:IT"), or ''. @param {string} html */
const flagOf = (html) => /\bflag:([A-Z]{2})\b/.exec(html)?.[1] ?? '';

/** A name from a race page slug: "qatar-1812km-2027" as "Qatar 1812km". @param {string} slug */
const nameFromSlug = (slug) =>
  slug
    .replace(/-\d{4}$/, '')
    .split('-')
    .filter(Boolean)
    .map((w, i) => (i > 0 && /^(of|the|and)$/.test(w) ? w : w[0].toUpperCase() + w.slice(1)))
    .join(' ');

/** A round of the season, not the prologue (a test day), and not another year's race. @param {string} slug @param {string} name @param {number} season */
function isRound(slug, name, season) {
  if (/prologue/i.test(`${slug} ${name}`)) return false;
  const year = /-(\d{4})$/.exec(slug)?.[1];
  return year === undefined || Number(year) === season;
}

/** @param {string} zone */
function isZone(zone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

/** @param {string} code */
function countryName(code) {
  if (!code) return '';
  try {
    return new Intl.DisplayNames(['en'], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

// The season page.

/**
 * One round as the season page lists it.
 * @typedef {object} SeasonEntry
 * @property {string} slug The race page's slug, such as "6-hours-of-imola-2026".
 * @property {string} name
 * @property {boolean} nameFromSlug True when the page printed no name (the season overview): the race page's or the
 *   ICS's name is better.
 * @property {string} countryCode From the flag, '' when there is none.
 * @property {string | null} raceDay The race day (YYYY-MM-DD) from the season overview, when it lists the season.
 * @property {number | null} raceId From the standings selector, when it gives one.
 */

/** @param {string} html @param {number} season @returns {SeasonEntry[]} */
function raceListEntries(html, season) {
  /** @type {SeasonEntry[]} */
  const out = [];
  for (const chunk of html.split(/<div\b[^>]*\bclass="race-item\b[^"]*"[^>]*>/).slice(1)) {
    const slug = /\bhref="(?:https:\/\/www\.fiawec\.com)?\/en\/race\/([a-z0-9-]+)"/i.exec(chunk)?.[1];
    if (!slug) continue;
    const name = textOf(/<span\b[^>]*\bclass="name"[^>]*>([\s\S]*?)<\/span>/.exec(chunk)?.[1] ?? '');
    if (!isRound(slug, name, season)) continue;
    out.push({ slug, name: name || nameFromSlug(slug), nameFromSlug: !name, countryCode: flagOf(chunk), raceDay: null, raceId: null });
  }
  return out;
}

/** The season overview's rounds of `season`, or null when the overview does not show that season. @param {string} html @param {number} season @returns {SeasonEntry[] | null} */
function overviewEntries(html, season) {
  /** @type {string | null} */
  let key = null;
  for (const m of html.matchAll(/<button\b[^>]*\bdata-season="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
    if (new RegExp(`\\b${season}\\b`).test(textOf(m[2]))) {
      key = m[1];
      break;
    }
  }
  if (key === null) return null;
  const open = [...html.matchAll(/<div\b[^>]*\bclass="season-content\b[^"]*"[^>]*>/g)].find((m) => m[0].includes(`data-season="${key}"`));
  if (!open) return null;
  const rest = html.slice((open.index ?? 0) + open[0].length);
  const end = rest.search(/\bclass="season-content\b|<\/header>|<main\b/);
  const block = end < 0 ? rest : rest.slice(0, end);
  /** @type {SeasonEntry[]} */
  const out = [];
  for (const m of block.matchAll(/<a\b[^>]*\bhref="(?:https:\/\/www\.fiawec\.com)?\/en\/race\/([a-z0-9-]+)"[^>]*>([\s\S]*?)<\/a>/gi)) {
    const slug = m[1];
    if (!isRound(slug, '', season) || out.some((e) => e.slug === slug)) continue;
    const day = /<strong\b[^>]*>\s*(\d{1,2})\s*<\/strong>/.exec(m[2])?.[1];
    const month = monthOf(/<small\b[^>]*>\s*([a-z]{3,})/i.exec(m[2])?.[1] ?? '');
    const raceDay = day && month ? `${season}-${month}-${day.padStart(2, '0')}` : null;
    out.push({ slug, name: nameFromSlug(slug), nameFromSlug: true, countryCode: flagOf(m[2]), raceDay, raceId: null });
  }
  return out;
}

/** The standings selector's race ids, in the page's order, with their flags. @param {string} html */
function selectorRaceIds(html) {
  /** @type {{ id: number, flag: string }[]} */
  const out = [];
  for (const m of html.matchAll(/<a\b([^>]*\bdata-model="raceId"[^>]*)>([\s\S]*?)<\/a>/g)) {
    const id = Number(/\bdata-value="(\d+)"/.exec(m[1])?.[1]);
    if (!Number.isInteger(id) || id <= 0 || out.some((x) => x.id === id)) continue;
    out.push({ id, flag: flagOf(m[2]) });
  }
  return out;
}

/**
 * The season page's rounds, in order, the prologue left out: its race list, or while that is empty the season
 * overview (which then also gives the race days). The race ids come from the standings selector when it lists as many
 * races with the same flags. An empty list is a season not published yet.
 * @param {string} html @param {number} season
 * @returns {SeasonEntry[]}
 */
export function parseSeasonPage(html, season) {
  const listAt = html.search(/\bclass="race-list\b/);
  const overview = overviewEntries(html, season);
  if (listAt < 0 && overview === null) throw new ShapeError(SRC, `the season page of ${season} has neither a race list nor a season overview`);
  let entries = listAt < 0 ? [] : raceListEntries(html.slice(listAt), season);
  if (entries.length === 0) entries = overview ?? [];
  else if (overview) for (const e of entries) e.raceDay = overview.find((o) => o.slug === e.slug)?.raceDay ?? null;
  const ids = selectorRaceIds(html);
  if (ids.length > 0 && ids.length === entries.length && ids.every((x, i) => !x.flag || !entries[i].countryCode || x.flag === entries[i].countryCode))
    entries.forEach((e, i) => (e.raceId = ids[i].id));
  return entries;
}

// The sessions.

/** @param {string} part @returns {{ kind: SessionKind, slug: string } | null} */
function baseOf(part) {
  const p = part.toLowerCase().replace(/^(?:hypercar|lmgt3|lmp2)\s+/, '');
  let m;
  if ((m = /^free practice\s*(\d*)\b/.exec(p))) return { kind: 'practice', slug: `fp${m[1]}` };
  if (/^warm[\s-]?up\b/.test(p)) return { kind: 'practice', slug: 'warm-up' };
  if ((m = /^qualifying\s*(\d*)\b/.exec(p))) return { kind: 'qualifying', slug: `q${m[1]}` };
  if ((m = /^hyperpole\s*(\d*)\b/.exec(p))) return { kind: 'hyperpole', slug: `hp${m[1]}` };
  if ((m = /^race\s*(\d*)\b/.exec(p))) return { kind: 'race', slug: `race${m[1]}` };
  return null;
}

/** The classes a text names, in order: "Hyperpole 1 - LMP2 & LMGT3" names lmp2 and lmgt3. @param {string} text */
function classesIn(text) {
  /** @type {SessionClass[]} */
  const out = [];
  for (const m of text.matchAll(/\b(hypercar|lmgt3|lmp2)\b/gi)) {
    const c = /** @type {SessionClass} */ (m[1].toLowerCase());
    if (!out.includes(c)) out.push(c);
  }
  return out;
}

/**
 * A session from its printed name, with or without the race's name before it ("6 Hours of Monza - Qualifying -
 * HYPERCAR"): its kind, the slug of its id ("q-hypercar", "hp1-lmp2-lmgt3", "fp1", "race"), its name as printed from
 * the session's word on, and its class (one class named, else 'none'). Null for anything else (an autograph session).
 * @param {string} text
 * @returns {{ kind: SessionKind, slug: string, name: string, class: SessionClass } | null}
 */
export function sessionFromName(text) {
  const parts = text.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean);
  for (let i = 0; i < parts.length; i++) {
    const base = baseOf(parts[i]);
    if (!base) continue;
    const name = parts.slice(i).join(' - ');
    const classes = classesIn(name);
    return { kind: base.kind, slug: [base.slug, ...classes].join('-'), name, class: classes.length === 1 ? classes[0] : 'none' };
  }
  return null;
}

/** @typedef {{ name: string, startUtc: string, endUtc: string | null, localDate: string, timeConfidence: TimeConfidence, cancelled: boolean }} Timed */

/** Sessions from timed names, sorted by start, ids unique in the round. @param {Timed[]} items @param {number} round @param {Date} now */
function toSessions(items, round, now) {
  const sorted = [...items].sort((a, b) => Date.parse(a.startUtc) - Date.parse(b.startUtc));
  const used = new Set();
  /** @type {Session[]} */
  const out = [];
  for (const it of sorted) {
    const k = sessionFromName(it.name);
    if (!k) continue;
    let id = sessionId(round, k.slug);
    for (let n = 2; used.has(id); n++) id = sessionId(round, `${k.slug}-${n}`);
    used.add(id);
    out.push({
      id,
      kind: k.kind,
      name: k.name,
      class: k.class,
      startUtc: it.startUtc,
      endUtc: it.endUtc,
      localDate: it.localDate,
      timeConfidence: it.timeConfidence,
      status: statusAt(it, now, it.cancelled),
      resultsState: 'none',
    });
  }
  return out;
}

// The ICS.

/** @typedef {{ local: string, tzid: string | null, dateOnly: boolean }} IcsTime */
/** @typedef {{ summary: string, status: string, start: IcsTime | null, end: IcsTime | null }} IcsEvent */

/** @param {string} value @param {Record<string, string>} params @returns {IcsTime | null} */
function icsTime(value, params) {
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?Z?)?$/.exec(value.trim());
  if (!m) return null;
  const date = `${m[1]}-${m[2]}-${m[3]}`;
  if (m[4] === undefined || params.VALUE === 'DATE') return { local: date, tzid: null, dateOnly: true };
  return { local: `${date}T${m[4]}:${m[5]}:${m[6] ?? '00'}`, tzid: params.TZID ?? null, dateOnly: false };
}

/** @param {string} v */
const unescapeIcs = (v) => v.replace(/\\([,;\\nN])/g, (_, c) => (c === 'n' || c === 'N' ? ' ' : c)).trim();

/** An iCalendar file's events (lines unfolded, texts unescaped). @param {string} text @returns {IcsEvent[]} */
export function icsEvents(text) {
  if (!/^BEGIN:VCALENDAR\s*$/m.test(text)) throw new ShapeError(SRC, 'the race calendar is not an iCalendar file');
  /** @type {IcsEvent[]} */
  const out = [];
  /** @type {IcsEvent | null} */
  let ev = null;
  for (const line of text.replace(/\r?\n[ \t]/g, '').split(/\r?\n/)) {
    if (/^BEGIN:VEVENT\s*$/.test(line)) ev = { summary: '', status: '', start: null, end: null };
    else if (/^END:VEVENT\s*$/.test(line)) {
      if (ev) out.push(ev);
      ev = null;
    } else if (ev) {
      const m = /^([A-Za-z0-9-]+)((?:;[^:]*)?):(.*)$/.exec(line);
      if (!m) continue;
      /** @type {Record<string, string>} */
      const params = {};
      for (const p of m[2].split(';').slice(1)) {
        const eq = p.indexOf('=');
        if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, '');
      }
      const name = m[1].toUpperCase();
      if (name === 'SUMMARY') ev.summary = unescapeIcs(m[3]);
      else if (name === 'STATUS') ev.status = m[3].trim().toUpperCase();
      else if (name === 'DTSTART') ev.start = icsTime(m[3], params);
      else if (name === 'DTEND') ev.end = icsTime(m[3], params);
    }
  }
  return out;
}

/** An ICS time as UTC: its own TZID when that is a zone, else the circuit's clock (a "Z" included, see the top). @param {IcsTime} t @param {string} timeZone */
const icsUtc = (t, timeZone) => localToUtc(t.local, t.tzid && isZone(t.tzid) ? t.tzid : timeZone);

/**
 * A round's sessions from its ICS. Times with a TZID are read in that zone; a "Z" or a floating time is the circuit's
 * clock (Le Mans); a date with no time is a 'tbc' session at the circuit's midday. The local date is the circuit's.
 * @param {string} text @param {string} timeZone the circuit's IANA zone @param {number} round @param {Date} now
 * @returns {Session[]}
 */
export function parseIcs(text, timeZone, round, now) {
  /** @type {Timed[]} */
  const items = [];
  for (const ev of icsEvents(text)) {
    if (!ev.start || !ev.summary) continue;
    const cancelled = ev.status === 'CANCELLED';
    if (ev.start.dateOnly) {
      const startUtc = localToUtc(`${ev.start.local}T12:00:00`, timeZone);
      items.push({ name: ev.summary, startUtc, endUtc: null, localDate: ev.start.local, timeConfidence: 'tbc', cancelled });
      continue;
    }
    const startUtc = icsUtc(ev.start, timeZone);
    const endUtc = ev.end && !ev.end.dateOnly ? icsUtc(ev.end, timeZone) : null;
    items.push({ name: ev.summary, startUtc, endUtc, localDate: localDateOf(startUtc, timeZone), timeConfidence: 'confirmed', cancelled });
  }
  return toSessions(items, round, now);
}

/** The race's name as the ICS prints it before a session's name ("6 Hours of Monza"), or ''. @param {string} text */
function icsRaceName(text) {
  for (const ev of icsEvents(text)) {
    const parts = ev.summary.split(/\s+-\s+/);
    const at = parts.findIndex((p) => baseOf(p) !== null);
    if (at > 0) return parts.slice(0, at).join(' - ').trim();
  }
  return '';
}

/** The first valid TZID an ICS names, or null. @param {string} text */
function icsZone(text) {
  for (const m of text.matchAll(/;TZID="?([^:;"]+)"?[:;]/g)) if (isZone(m[1])) return m[1];
  return null;
}

// The race page.

/** "March 25 th" or "25 March" in `season`, as YYYY-MM-DD, or null. @param {string} text @param {number} season */
function dayOf(text, season) {
  const a = /([a-z]{3,})\.?\s+(\d{1,2})\b/i.exec(text);
  const b = /\b(\d{1,2})\s+([a-z]{3,})/i.exec(text);
  const month = a ? monthOf(a[1]) : b ? monthOf(b[2]) : null;
  const day = a && month ? a[2] : b ? b[1] : null;
  return month && day ? `${season}-${month}-${day.padStart(2, '0')}` : null;
}

/**
 * A race page: its title, its race id (the "Add to my calendar" link) and its programme. A session with a timestamp
 * is confirmed at it (its end unknown); one under a day with "TBC" is a 'tbc' session at the circuit's midday.
 * @param {string} html @param {number} season @param {string} timeZone @param {number} round @param {Date} now
 * @returns {{ name: string, raceId: number | null, sessions: Session[] }}
 */
export function parseRacePage(html, season, timeZone, round, now) {
  const name = textOf(/<h1\b[^>]*>([\s\S]*?)<\/h1>/.exec(html)?.[1] ?? '');
  const raceId = Number(/\/race\/calendar\/(\d+)/.exec(html)?.[1]) || null;
  /** @type {{ name: string, day: string | null, at: number | null }[]} */
  const found = [];
  /** @type {string | null} */
  let day = null;
  const re =
    /<div\b[^>]*\bclass="[^"]*\bfw-extrabold\b[^"]*\bfs-5\b[^"]*"[^>]*>([\s\S]*?)<\/div>|<div\b[^>]*\bclass="fw-bold lh-sm\b[^"]*"[^>]*>([\s\S]*?)<\/div>|\bdata-timestamp="(\d+)"/g;
  for (const m of html.matchAll(re)) {
    if (m[1] !== undefined) day = dayOf(textOf(m[1]), season);
    else if (m[2] !== undefined) found.push({ name: textOf(m[2]), day, at: null });
    else if (m[3] !== undefined && found.length > 0) found[found.length - 1].at = Number(m[3]);
  }
  /** @type {Timed[]} */
  const items = [];
  for (const f of found) {
    if (f.at) {
      const startUtc = new Date(f.at * 1000).toISOString().replace('.000Z', 'Z');
      items.push({ name: f.name, startUtc, endUtc: null, localDate: localDateOf(startUtc, timeZone), timeConfidence: 'confirmed', cancelled: false });
    } else if (f.day) {
      const startUtc = localToUtc(`${f.day}T12:00:00`, timeZone);
      items.push({ name: f.name, startUtc, endUtc: null, localDate: f.day, timeConfidence: 'tbc', cancelled: false });
    }
  }
  return { name, raceId, sessions: toSessions(items, round, now) };
}

// The calendar.

/** The circuit a round names, its flag agreeing. @param {SeasonEntry} e @returns {Circuit | null} */
function circuitOf(e) {
  const words = e.slug.replace(/-\d{4}$/, '').replace(/-/g, ' ');
  const override = CIRCUIT_OVERRIDES.find(([re]) => re.test(words) || re.test(e.name));
  const c = override ? CIRCUITS.find((x) => x.key === override[1]) ?? null : findCircuit(words, e.name);
  return c && e.countryCode && c.countryCode !== e.countryCode ? null : c;
}

/**
 * One round: the ICS when it has events, else the race page's programme, else no sessions and the race day. Null for a
 * round with no date at all (left out).
 * @param {number} season @param {number} round @param {SeasonEntry} e @param {SourceDeps} deps @param {Date} now
 * @returns {Promise<Round | null>}
 */
async function readRound(season, round, e, deps, now) {
  const circuit = circuitOf(e);
  let timeZone = circuit?.timeZone ?? null;
  let name = e.name;
  /** @type {number | null} */
  let raceId = e.raceId ?? KNOWN_RACE_IDS[e.slug] ?? null;
  let url = racePageUrl(e.slug);
  /** @type {Session[]} */
  let sessions = [];
  /** @type {ReturnType<typeof parseRacePage> | null} */
  let page = null;
  let pageRead = false;
  const readPage = async () => {
    if (!pageRead) {
      pageRead = true;
      const html = await getText(deps, racePageUrl(e.slug), HTML);
      page = html === null ? null : parseRacePage(html, season, timeZone ?? 'UTC', round, now);
    }
    return page;
  };

  if (raceId === null) raceId = (await readPage())?.raceId ?? null;
  if (raceId !== null) {
    const ics = await getText(deps, icsUrl(raceId));
    if (ics !== null) {
      timeZone ??= icsZone(ics);
      sessions = parseIcs(ics, timeZone ?? 'UTC', round, now);
      if (sessions.length > 0) {
        url = icsUrl(raceId);
        if (e.nameFromSlug) name = icsRaceName(ics) || name;
      }
    }
  }
  if (sessions.length === 0) {
    const p = await readPage();
    if (p) {
      sessions = p.sessions;
      if (e.nameFromSlug && p.name) name = p.name;
    }
  }

  const tz = timeZone ?? 'UTC';
  const span = roundSpan(sessions, tz, now, e.raceDay ? { startDate: e.raceDay, endDate: e.raceDay } : undefined);
  if (!span.startDate) return null;
  return {
    round,
    name,
    circuitName: circuit ? CIRCUIT_NAMES[circuit.key] ?? '' : '',
    city: circuit?.city ?? '',
    country: circuit?.country ?? countryName(e.countryCode),
    countryCode: circuit?.countryCode ?? e.countryCode,
    timeZone: tz,
    ...(circuit ? { circuitKey: circuit.key } : {}),
    lat: null,
    long: null,
    ...span,
    source: { name: NAME, url, fetchedAt: now.toISOString() },
    sessions,
  };
}

// The tables.

/** @typedef {{ head: string[], rows: string[][] }} Table A table's header cells and body rows, as HTML. */

/** The first table in `html`, or null. @param {string} html @returns {Table | null} */
function tableOf(html) {
  const t = /<table\b[^>]*>([\s\S]*?)<\/table>/.exec(html);
  if (!t) return null;
  const thead = /<thead\b[^>]*>([\s\S]*?)<\/thead>/.exec(t[1]);
  const head = [...(thead?.[1] ?? '').matchAll(/<(th|td)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((m) => m[2]);
  const body = /<tbody\b[^>]*>([\s\S]*?)<\/tbody>/.exec(t[1])?.[1] ?? (thead ? t[1].replace(thead[0], '') : t[1]);
  const rows = [...body.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)].map((r) => [...r[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1>/g)].map((c) => c[2]));
  return { head, rows };
}

/** The index of the first header whose text matches, or -1. @param {Table} t @param {RegExp} re */
const columnOf = (t, re) => t.head.findIndex((h) => re.test(textOf(h)));

/** A cell's text, '' when the row is short. @param {string[]} cells @param {number} i */
const cellText = (cells, i) => (i >= 0 && i < cells.length ? textOf(cells[i]) : '');

/** The live component's props (data-live-props-value), or null. @param {string} html @param {string} component @returns {Record<string, unknown> | null} */
function componentProps(html, component) {
  const at = html.indexOf(`data-live-name-value="Editorial:CMS:${component}"`);
  // the whole tag, quoted values read whole (a value may hold a ">")
  const tag = at < 0 ? undefined : /^<[a-z]+\b(?:[^>"]|"[^"]*")*>/i.exec(html.slice(html.lastIndexOf('<', at)))?.[0];
  const raw = tag ? /\bdata-live-props-value="([^"]*)"/.exec(tag)?.[1] : undefined;
  if (raw === undefined) return null;
  try {
    const v = JSON.parse(decodeEntities(raw));
    return isRecord(v) ? v : null;
  } catch {
    return null;
  }
}

// The results.

/**
 * @typedef {object} ResultsPage
 * @property {number} raceId
 * @property {number | null} sessionId The session the page shows.
 * @property {number | null} seasonId
 * @property {{ id: number, name: string }[]} sessions The race's sessions the page lists.
 * @property {SessionClass | null} class The table's class, from its heading ("Hypercar - Final").
 * @property {'provisional' | 'final'} state
 * @property {ResultRow[]} rows No driver names: the page prints none (parseCrews gives them).
 */

/**
 * The results page: which race and session it shows, the race's sessions, and the table. A ShapeError when the
 * results component or the table's Pos. and Team columns are missing; no table is no rows.
 * @param {string} html
 * @returns {ResultsPage}
 */
export function parseResults(html) {
  const props = componentProps(html, 'CompleteResultsComponent');
  const raceId = props ? num(props.raceId) : null;
  if (!props || raceId === null) throw new ShapeError(SRC, 'the results page has no results component');
  /** @type {{ id: number, name: string }[]} */
  const sessions = [];
  for (const m of html.matchAll(/<a\b([^>]*\bdata-live-action-param="changeSession"[^>]*)>([\s\S]*?)<\/a>/g)) {
    const id = Number(/\bdata-live-id-param="(\d+)"/.exec(m[1])?.[1]);
    const name = textOf(m[2]) || decodeEntities(/\btitle="([^"]*)"/.exec(m[1])?.[1] ?? '').trim();
    if (Number.isInteger(id) && id > 0 && name && !sessions.some((s) => s.id === id)) sessions.push({ id, name });
  }
  const base = { raceId, sessionId: num(props.sessionId), seasonId: num(props.seasonId), sessions };
  const at = html.search(/<table\b/);
  if (at < 0) return { ...base, class: null, state: 'provisional', rows: [] };
  const heading = [...html.slice(Math.max(0, at - 1000), at).matchAll(/<div\b[^>]*>([^<]+)<\/div>/g)].map((m) => textOf(m[1])).filter(Boolean).pop() ?? '';
  const cls = classesIn(heading)[0] ?? null;
  const table = tableOf(html.slice(at));
  const pos = table ? columnOf(table, /^pos\.?$/i) : -1;
  const team = table ? columnOf(table, /^team$/i) : -1;
  if (!table || pos < 0 || team < 0) throw new ShapeError(SRC, 'the results table has no Pos. or Team column');
  const car = columnOf(table, /^n\s*[°o]\.?$|^#$|^car$/i);
  const laps = columnOf(table, /^laps$/i);
  const total = columnOf(table, /^total time$/i);
  const gap = columnOf(table, /^gap$/i);
  const best = columnOf(table, /^best lap$/i);
  /** @param {string} s */
  const blank = (s) => s === '' || s === '-';
  /** @type {ResultRow[]} */
  const rows = [];
  for (const cells of table.rows) {
    const teamName = cellText(cells, team);
    if (!teamName) continue;
    const posText = cellText(cells, pos);
    const position = /^\d+$/.test(posText) ? Number(posText) : null;
    const g = cellText(cells, gap);
    let timeOrGap;
    if (total >= 0) {
      const t = cellText(cells, total);
      timeOrGap = position === 1 ? t : !blank(g) ? g : position === null && posText ? posText : t;
    } else {
      const b = cellText(cells, best);
      timeOrGap = !blank(b) ? b : !blank(g) ? g : position === null ? posText : '';
    }
    /** @type {ResultRow} */
    const row = { position, driverName: '', team: teamName, timeOrGap };
    const number = cellText(cells, car).replace(/^#/, '');
    if (number) row.carNumber = number;
    const lapCount = num(cellText(cells, laps));
    if (lapCount !== null) row.laps = lapCount;
    if (cls) row.class = cls;
    rows.push(row);
  }
  return { ...base, class: cls, state: /\b(final|official)\b/i.test(heading) ? 'final' : 'provisional', rows };
}

/** @param {string} s */
const sameName = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();

/** The race id of a round, from its source's URL (the ICS's id, else the race page's slug). @param {Round} round @param {SourceDeps} deps */
async function raceIdOf(round, deps) {
  const fromIcs = /\/race\/calendar\/(\d+)/.exec(round.source.url)?.[1];
  if (fromIcs) return Number(fromIcs);
  const slug = /\/en\/race\/([a-z0-9-]+)$/i.exec(round.source.url)?.[1];
  if (!slug) return null;
  if (KNOWN_RACE_IDS[slug]) return KNOWN_RACE_IDS[slug];
  const html = await getText(deps, racePageUrl(slug), HTML);
  const id = html === null ? undefined : /\/race\/calendar\/(\d+)/.exec(html)?.[1];
  return id ? Number(id) : null;
}

// The standings and the crews.

/** The tables under a titled collapse button ("FIA Hypercar World Endurance Drivers Championship"). @param {string} html */
function titledTables(html) {
  /** @type {{ title: string, table: Table }[]} */
  const out = [];
  for (const m of html.matchAll(/\bdata-bs-target="#([\w-]+)"[^>]*>([\s\S]*?)<\/button>/g)) {
    const at = html.indexOf(`id="${m[1]}"`, m.index ?? 0);
    if (at < 0) continue;
    const next = html.indexOf('data-bs-target=', at);
    const table = tableOf(next < 0 ? html.slice(at) : html.slice(at, next));
    if (table && columnOf(table, /^pos\.?$/i) >= 0) out.push({ title: textOf(m[2]), table });
  }
  return out;
}

/** A drivers cell's names: its links, else its text split on commas. @param {string} cell */
function driversOf(cell) {
  const linked = [...cell.matchAll(/<a\b[^>]*>([\s\S]*?)<\/a>/g)].map((m) => textOf(m[1])).filter(Boolean);
  return linked.length > 0 ? linked : textOf(cell).split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Each car's season drivers, from every drivers' table of the classification page (all classes): "38" gives ["EARL
 * BAMBER", "SÉBASTIEN BOURDAIS"]. A car's drivers who scored apart are joined.
 * @param {string} html
 * @returns {Map<string, string[]>}
 */
export function parseCrews(html) {
  /** @type {Map<string, string[]>} */
  const crews = new Map();
  for (const { title, table } of titledTables(html)) {
    if (!/driver/i.test(title)) continue;
    const car = columnOf(table, /^n\s*[°o]\.?$|^#$|^car$/i);
    const names = columnOf(table, /^drivers?$/i);
    if (car < 0 || names < 0) continue;
    for (const cells of table.rows) {
      const number = cellText(cells, car).replace(/^#/, '');
      if (!number || names >= cells.length) continue;
      const crew = crews.get(number) ?? [];
      for (const n of driversOf(cells[names])) if (!crew.includes(n)) crew.push(n);
      crews.set(number, crew);
    }
  }
  return crews;
}

/** @type {WeakMap<import('../http.mjs').Get, Map<number, { at: number, crews: Map<string, string[]> }>>} */
const CREW_CACHE = new WeakMap();
const CREW_TTL_MS = 6 * 3_600_000;

/** A season's crews, read once per getter and 6 hours; a failure is no crews (the rows keep empty names). @param {number} seasonId @param {SourceDeps} deps */
async function crewsFor(seasonId, deps) {
  let bySeason = CREW_CACHE.get(deps.get);
  if (!bySeason) CREW_CACHE.set(deps.get, (bySeason = new Map()));
  const t = deps.now().getTime();
  const hit = bySeason.get(seasonId);
  if (hit && t - hit.at < CREW_TTL_MS) return hit.crews;
  try {
    const html = await getText(deps, standingsUrl(seasonId), HTML);
    const crews = html === null ? new Map() : parseCrews(html);
    if (crews.size > 0) bySeason.set(seasonId, { at: t, crews });
    return crews;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    return /** @type {Map<string, string[]>} */ (new Map());
  }
}

/**
 * The classification page's season: its id, the season options, and its year (the option's name, else the
 * "General classification" year). The year is null when the page names none.
 * @param {string} html
 */
export function seasonInfo(html) {
  const podium = componentProps(html, 'ManufacturerPodiumComponent');
  const standing = componentProps(html, 'StandingComponent');
  const seasonId = num(podium?.seasonId) ?? num(standing?.seasonId);
  /** @type {{ id: number, name: string }[]} */
  const options = [];
  const raw = podium?.seasonOptions;
  if (Array.isArray(raw))
    for (const o of raw) {
      const id = isRecord(o) ? num(o.id) : null;
      if (id !== null && isRecord(o) && typeof o.name === 'string') options.push({ id, name: o.name.trim() });
    }
  const label = /General classification\s*<\/h2>\s*<div\b[^>]*>\s*(\d{4})\s*<\/div>/i.exec(html)?.[1];
  const year = Number(options.find((o) => o.id === seasonId)?.name ?? label) || null;
  return { seasonId, options, year };
}

/** @param {Table} table @param {StandingsKind} kind @param {string} title @returns {StandingsDoc | null} */
function standingsDoc(table, kind, title) {
  const pos = columnOf(table, /^pos\.?$/i);
  const total = columnOf(table, /^total( points)?$/i);
  const nameCol = kind === 'teams' ? columnOf(table, /^(manufacturer|team)s?$/i) : columnOf(table, /^drivers?$/i);
  if (pos < 0 || total < 0 || nameCol < 0) throw new ShapeError(SRC, `"${title}" has no Pos., name or Total points column`);
  const man = columnOf(table, /^man\.?$/i);
  const car = columnOf(table, /^n\s*[°o]\.?$|^#$|^car$/i);
  const races = table.head.flatMap((h, i) => (/\bhref="[^"]*\/race\//.test(h) ? [i] : []));
  /** @type {StandingsDoc['rows']} */
  const rows = [];
  for (const cells of table.rows) {
    const position = num(cellText(cells, pos));
    const points = num(cellText(cells, total));
    const name = kind === 'teams' ? cellText(cells, nameCol) : nameCol < cells.length ? driversOf(cells[nameCol]).join(', ') : '';
    if (position === null || points === null || !name) continue;
    const brand = man >= 0 && man < cells.length ? decodeEntities(/\balt="([^"]*)"/.exec(cells[man])?.[1] ?? '').trim() || cellText(cells, man) : '';
    const team = kind === 'drivers' ? [brand, cellText(cells, car)].filter(Boolean).join(' ') : '';
    rows.push(team ? { position, name, team, points } : { position, name, points });
  }
  if (rows.length === 0) {
    if (table.rows.length > 0) throw new ShapeError(SRC, `"${title}" has rows but none reads`);
    return null;
  }
  const afterRound = races.reduce((last, c, i) => (table.rows.some((r) => !/^-?$/.test(cellText(r, c))) ? i + 1 : last), 0);
  return { kind, afterRound, rows };
}

/**
 * The classification page's season and its Hypercar standings: the manufacturers' championship (teams) and the
 * drivers' (one row per crew as printed, "TOYOTA #8" its team). After round: the last race column with a score. A
 * ShapeError when it has neither table or names no season.
 * @param {string} html
 */
export function parseStandings(html) {
  const info = seasonInfo(html);
  const tables = titledTables(html);
  const teams = tables.find((t) => /hypercar/i.test(t.title) && /manufacturer/i.test(t.title));
  const drivers = tables.find((t) => /hypercar/i.test(t.title) && /driver/i.test(t.title));
  if (!teams && !drivers) throw new ShapeError(SRC, 'the classification page has no Hypercar table');
  if (info.year === null) throw new ShapeError(SRC, 'the classification page names no season');
  return {
    ...info,
    teams: teams ? standingsDoc(teams.table, 'teams', teams.title) : null,
    drivers: drivers ? standingsDoc(drivers.table, 'drivers', drivers.title) : null,
  };
}

// The AI repair (RW.RESEARCH 1.8): the page's text in, plain JSON out, validated here.

/** What the repair step reads: the page's main text (scripts and styles out, cells marked "|"), cut to REPAIR_MAX. @param {string} html */
export function repairText(html) {
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1] ?? html;
  const clean = main
    .replace(/<(script|style|svg|noscript)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<\/(td|th)>/gi, ' |$&')
    .replace(/<\/tr>/gi, ' ||$&');
  return textOf(clean).slice(0, REPAIR_MAX);
}

/** @param {unknown} v */
const strOf = (v) => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : null);

/** A repaired result row, or null when it does not hold. @param {unknown} v @returns {ResultRow | null} */
function repairedResultRow(v) {
  if (!isRecord(v)) return null;
  const p = v.position;
  const position = p === null || p === undefined ? null : typeof p === 'number' && Number.isInteger(p) && p > 0 ? p : undefined;
  const team = strOf(v.team);
  const timeOrGap = strOf(v.timeOrGap);
  if (position === undefined || !team || timeOrGap === null || typeof v.driverName !== 'string') return null;
  /** @type {ResultRow} */
  const row = { position, driverName: v.driverName.trim(), team, timeOrGap };
  const car = strOf(v.carNumber);
  if (car) row.carNumber = car.replace(/^#/, '');
  for (const key of /** @type {const} */ (['laps', 'points'])) {
    const n = v[key];
    if (n === undefined || n === null) continue;
    if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return null;
    row[key] = n;
  }
  if (v.class !== undefined) {
    if (typeof v.class !== 'string' || !['hypercar', 'lmgt3', 'lmp2', 'none'].includes(v.class)) return null;
    row.class = /** @type {SessionClass} */ (v.class);
  }
  return row;
}

/** A repaired standings row, or null. @param {unknown} v @returns {StandingsDoc['rows'][number] | null} */
function repairedStandingsRow(v) {
  if (!isRecord(v)) return null;
  const { position, points } = v;
  const name = strOf(v.name);
  if (typeof position !== 'number' || !Number.isInteger(position) || position <= 0) return null;
  if (typeof points !== 'number' || !Number.isFinite(points) || points < 0 || !name) return null;
  const team = typeof v.team === 'string' ? v.team.trim() : '';
  return team ? { position, name, team, points } : { position, name, points };
}

/** @param {Error} err @param {SourceDeps} deps @param {'results' | 'standings'} what @param {string} url @param {string} html */
async function askRepair(err, deps, what, url, html) {
  if (!deps.repair) throw err;
  try {
    return await deps.repair({ series: 'wec', what, url, text: repairText(html) });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') throw e;
    throw err;
  }
}

/**
 * Results the repair step read: `[rows]` or `{ state?, rows }`, each row checked; none valid is the original error.
 * @param {Error} err @param {string} url @param {string} html @param {SourceDeps} deps
 * @returns {Promise<ResultDoc>}
 */
async function repairResults(err, url, html, deps) {
  const answer = await askRepair(err, deps, 'results', url, html);
  const list = Array.isArray(answer) ? answer : isRecord(answer) && Array.isArray(answer.rows) ? answer.rows : [];
  const rows = list.flatMap((v) => {
    const r = repairedResultRow(v);
    return r ? [r] : [];
  });
  if (rows.length === 0) throw err;
  const state = isRecord(answer) && answer.state === 'final' ? 'final' : 'provisional';
  return { state, fetchedAt: deps.now().toISOString(), rows, source: { name: `${NAME} (read with AI repair)`, url } };
}

/**
 * Standings the repair step read: `{ season?, afterRound?, drivers?: rows, teams?: rows }`, each row checked; none
 * valid is the original error, and so is another season when the page names none.
 * @param {Error} err @param {string} url @param {string} html @param {number} season @param {boolean} seasonKnown
 * @param {SourceDeps} deps
 * @returns {Promise<{ drivers: StandingsDoc | null, teams: StandingsDoc | null }>}
 */
async function repairStandings(err, url, html, season, seasonKnown, deps) {
  const answer = await askRepair(err, deps, 'standings', url, html);
  if (!isRecord(answer)) throw err;
  if (!seasonKnown && num(answer.season) !== season) throw err;
  const a = answer.afterRound;
  const afterRound = typeof a === 'number' && Number.isInteger(a) && a >= 0 ? a : 0;
  /** @param {StandingsKind} kind @returns {StandingsDoc | null} */
  const doc = (kind) => {
    const list = answer[kind];
    const rows = Array.isArray(list)
      ? list.flatMap((v) => {
          const r = repairedStandingsRow(v);
          return r ? [r] : [];
        })
      : [];
    return rows.length > 0 ? { kind, afterRound, rows } : null;
  };
  const out = { drivers: doc('drivers'), teams: doc('teams') };
  if (!out.drivers && !out.teams) throw err;
  return out;
}

/** @param {unknown} e @param {SourceDeps} deps @returns {e is ShapeError} */
const repairable = (e, deps) => e instanceof ShapeError && deps.repair !== undefined;

// The source.

/** How long after a session's end its results are polled: the race 60 minutes, any other session none. @param {Session} session */
export function resultsWindowMinutes(session) {
  return session.kind === 'race' ? 60 : 0;
}

/** @type {import('../source.mjs').Source} */
export const source = {
  series: 'wec',
  name: NAME,

  async calendar(season, deps) {
    const html = await getText(deps, seasonUrl(season), HTML);
    if (html === null) return null;
    const entries = parseSeasonPage(html, season);
    if (entries.length === 0) return null;
    const now = deps.now();
    /** @type {Round[]} */
    const rounds = [];
    for (const [i, e] of entries.entries()) {
      const r = await readRound(season, i + 1, e, deps, now);
      if (r) rounds.push(r);
    }
    return rounds.length > 0 ? rounds : null;
  },

  async results(season, round, session, deps) {
    const raceId = await raceIdOf(round, deps);
    if (raceId === null) return null;
    let url = resultsUrl(raceId);
    const first = await getText(deps, url, HTML);
    if (first === null) return null;
    /** @type {ResultsPage} */
    let page;
    try {
      page = parseResults(first);
    } catch (e) {
      // the page without a session id shows the latest session: the race, once it is over
      if (repairable(e, deps) && session.kind === 'race' && statusAt(session, deps.now()) === 'completed') return repairResults(e, url, first, deps);
      throw e;
    }
    if (page.raceId !== raceId) return null;
    const listed = page.sessions.find((s) => sameName(s.name) === sameName(session.name));
    if (!listed) return null;
    if (listed.id !== page.sessionId) {
      url = resultsUrl(raceId, listed.id);
      const html = await getText(deps, url, HTML);
      if (html === null) return null;
      try {
        page = parseResults(html);
      } catch (e) {
        if (repairable(e, deps)) return repairResults(e, url, html, deps);
        throw e;
      }
      if (page.raceId !== raceId || page.sessionId !== listed.id) return null;
    }
    if (page.rows.length === 0) return null;
    // the page shows the Hypercar class whatever the session: a session of other classes has no result here
    const named = classesIn(session.name);
    if (named.length > 0 && page.class !== null && !named.includes(page.class)) return null;
    const crews = page.seasonId === null ? new Map() : await crewsFor(page.seasonId, deps);
    const rows = page.rows.map((r) => (r.carNumber && crews.has(r.carNumber) ? { ...r, driverName: (crews.get(r.carNumber) ?? []).join(', ') } : r));
    return { state: page.state, fetchedAt: deps.now().toISOString(), rows, source: { name: NAME, url } };
  },

  async standings(season, deps) {
    const none = { drivers: null, teams: null };
    let url = standingsUrl();
    let html = await getText(deps, url, HTML);
    if (html === null) return none;
    let info = seasonInfo(html);
    if (info.year !== null && info.year !== season) {
      const option = info.options.find((o) => o.name === String(season));
      if (!option) return none;
      url = standingsUrl(option.id);
      html = await getText(deps, url, HTML);
      if (html === null) return none;
      info = seasonInfo(html);
      if (info.year !== null && info.year !== season) return none;
    }
    try {
      const p = parseStandings(html);
      return { drivers: p.drivers, teams: p.teams };
    } catch (e) {
      if (repairable(e, deps)) return repairStandings(e, url, html, season, info.year === season, deps);
      throw e;
    }
  },

  resultsWindowMinutes,
};
