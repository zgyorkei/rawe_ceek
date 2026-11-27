// A result's one-line summary from fixed templates over its rows (RW.RESEARCH 1.3 and 1.9, decision D3): never written
// by an AI model, for every series. The words are ours; the names, teams and times are the source's.

/** @typedef {import('../../src/lib/raceData.ts').ResultRow} ResultRow */
/** @typedef {import('../../src/lib/raceData.ts').Session} Session */

const CLASS_NAMES = /** @type {const} */ ({ hypercar: 'Hypercar', lmgt3: 'LMGT3', lmp2: 'LMP2', none: '' });

/** @param {ResultRow} r */
const who = (r) => (r.team ? `${r.driverName} (${r.team})` : r.driverName);

/** The rows in finishing order, the unclassified last. @param {ResultRow[]} rows */
const ordered = (rows) => [...rows].sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity));

/** "A, B and C" @param {string[]} names */
const listOf = (names) => (names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`);

/**
 * The summary of a session's result, or undefined when the rows give none (no classified driver).
 * @param {Session} session @param {ResultRow[]} rows
 * @returns {string | undefined}
 */
export function resultSummary(session, rows) {
  const classes = [...new Set(rows.map((r) => r.class).filter((c) => c && c !== 'none'))];
  if (classes.length > 1) {
    // the WEC: one winner per class
    const winners = classes.map((c) => {
      const first = ordered(rows.filter((r) => r.class === c))[0];
      return first && first.position !== null ? `${CLASS_NAMES[/** @type {keyof typeof CLASS_NAMES} */ (c)]}: ${who(first)}` : null;
    }).filter((x) => x !== null);
    if (winners.length === 0) return undefined;
    const verb = session.kind === 'race' ? 'Class winners' : 'Fastest per class';
    return `${verb} in ${session.name}: ${winners.join('; ')}.`;
  }
  const top = ordered(rows).filter((r) => r.position !== null);
  const first = top[0];
  if (!first) return undefined;
  const rest = top.slice(1, 3).map((r) => r.driverName);
  const behind = rest.length ? `, ahead of ${listOf(rest)}` : '';
  switch (session.kind) {
    case 'race':
    case 'sprint':
      return `${who(first)} won the ${session.name}${behind}.`;
    case 'qualifying':
    case 'sprint-qualifying':
    case 'hyperpole':
      return `${who(first)} took pole in ${session.name}${behind}.`;
    default:
      return `${who(first)} was fastest in ${session.name}${behind}.`;
  }
}
