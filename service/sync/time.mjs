// Time, the one way (RW.RESEARCH 1.2, rule 1): every session is stored as a UTC instant plus the circuit's IANA zone,
// and the local clock is computed from those two, never from an offset a source prints (F1 Academy's are wrong all
// summer, the WEC's ICS has no zone definition, Jolpica gives UTC only).

/** @param {string} timeZone */
const partsFormat = (timeZone) =>
  new Intl.DateTimeFormat('en-GB', { timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });

/** The zone's offset from UTC at an instant, in minutes (east positive). @param {number} ms @param {string} timeZone */
export function zoneOffsetMinutes(ms, timeZone) {
  const p = Object.fromEntries(partsFormat(timeZone).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60_000);
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/;

/**
 * A circuit-local clock ("2026-11-28T19:15:00", any offset after it ignored) in an IANA zone, as a UTC ISO string.
 * @param {string} local @param {string} timeZone
 */
export function localToUtc(local, timeZone) {
  const m = LOCAL.exec(local);
  if (!m) throw new Error(`not a local date and time: ${local}`);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  // the offset at the guess, then again at the result: right on both sides of a daylight saving change
  let utc = wall - zoneOffsetMinutes(wall, timeZone) * 60_000;
  utc = wall - zoneOffsetMinutes(utc, timeZone) * 60_000;
  return new Date(utc).toISOString().replace('.000Z', 'Z');
}

/**
 * A local clock with a fixed offset ("2026-11-28T19:15:00" and "+03:00"), as a UTC ISO string: for a source whose
 * offsets are right (F2 and F3, OpenF1).
 * @param {string} local @param {string} offset
 */
export function offsetToUtc(local, offset) {
  const m = LOCAL.exec(local);
  const o = /^([+-])(\d{2}):?(\d{2})(?::?\d{2})?$/.exec(offset.trim());
  if (!m || !o) throw new Error(`not a local time with an offset: ${local} ${offset}`);
  const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] ?? 0));
  const minutes = (o[1] === '-' ? -1 : 1) * (+o[2] * 60 + +o[3]);
  return new Date(wall - minutes * 60_000).toISOString().replace('.000Z', 'Z');
}

/** The circuit-local date (YYYY-MM-DD) of a UTC instant: the calendar cell the session belongs to. @param {string} utc @param {string} timeZone */
export function localDateOf(utc, timeZone) {
  const p = Object.fromEntries(partsFormat(timeZone).formatToParts(new Date(utc)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** A UTC ISO string plus minutes. @param {string} utc @param {number} minutes */
export const addMinutes = (utc, minutes) => new Date(Date.parse(utc) + minutes * 60_000).toISOString().replace('.000Z', 'Z');

/** A normalised UTC ISO string (seconds, a Z) from anything Date can read. @param {string} value */
export const toUtc = (value) => {
  const ms = Date.parse(value);
  if (Number.isNaN(ms)) throw new Error(`not a date: ${value}`);
  return new Date(ms).toISOString().replace('.000Z', 'Z');
};
