import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShapeError } from '../../service/sync/http.mjs';
import type { Get } from '../../service/sync/http.mjs';
import {
  SITES,
  f2Source,
  f3Source,
  nextFlightText,
  parseRoundPage,
  parseSeasonRounds,
  parseStandingsTable,
  readRoundList,
  resultsWindowMinutes,
} from '../../service/sync/sources/fia.mjs';
import type { Round, Session } from '../../src/lib/raceData';

// The F2 and F3 sources against recorded pages (test/fixtures/f2 and f3, trimmed): the 2026 season pages (F2 rounds 4,
// 13 and 14; F3 rounds 2 and 9), those round pages, the standings tables, and F2's answer for a season it has not got.
// A fake getter maps each URL to its file; any other URL is a 404. No network.

const fixture = (name: string) => readFileSync(new URL(`../fixtures/${name}`, import.meta.url), 'utf8');

const F2 = 'https://www.fiaformula2.com';
const F3 = 'https://www.fiaformula3.com';

const FILES: Record<string, string> = {
  [`${F2}/en/racing/2026`]: 'f2/racing-2026.html',
  [`${F2}/en/racing/2026/monte-carlo`]: 'f2/monte-carlo.html',
  [`${F2}/en/racing/2026/lusail`]: 'f2/lusail.html',
  [`${F2}/en/racing/2026/yas-marina`]: 'f2/yas-marina.html',
  [`${F2}/en/standings/2026/drivers`]: 'f2/standings-drivers.html',
  [`${F2}/en/standings/2026/teams`]: 'f2/standings-teams.html',
  [`${F3}/en/racing/2026`]: 'f3/racing-2026.html',
  [`${F3}/en/racing/2026/monte-carlo`]: 'f3/monte-carlo.html',
  [`${F3}/en/racing/2026/madrid`]: 'f3/madrid.html',
  [`${F3}/en/standings/2026/drivers`]: 'f3/standings-drivers.html',
  [`${F3}/en/standings/2026/teams`]: 'f3/standings-teams.html',
};

/** Friday of the Qatar weekend: F2's practice and qualifying at Lusail are over, its races to come. */
const NOW = new Date('2026-11-27T16:30:00Z');

type Answer = { status: number; text: string };

/** A getter over the fixtures; `answers` replaces or adds URLs. */
function fake(answers: Record<string, Answer> = {}) {
  const calls: string[] = [];
  const get: Get = async (url) => {
    calls.push(url);
    const a = answers[url];
    if (a) return { ...a, url };
    const file = FILES[url];
    return file ? { status: 200, text: fixture(file), url } : { status: 404, text: '<html>404</html>', url };
  };
  return { deps: { get, now: () => NOW }, calls };
}

/** The sites' answer for a season they do not have: their "couldn't find the page", as an HTTP 500. */
const NOT_FOUND: Answer = { status: 500, text: fixture('f2/not-found.html') };

/** A round page with one flight chunk holding `race` (a meeting object). */
const roundPageWith = (race: unknown) =>
  `<html><body><script>(self.__next_f=self.__next_f||[]).push([0])</script><script>self.__next_f.push(${JSON.stringify([
    1,
    `79:${JSON.stringify(['$', 'div', null, { race }])}\n`,
  ])})</script></body></html>`;

const sessionOf = (round: Round, id: string): Session => {
  const s = round.sessions.find((x) => x.id === id);
  if (!s) throw new Error(`no session ${id}`);
  return s;
};

describe('F2 calendar', () => {
  it('reads the rounds from the season page and each round page, with the series round numbers', async () => {
    const { deps, calls } = fake();
    const rounds = (await f2Source.calendar(2026, deps)) ?? [];
    expect(rounds.map((r) => r.round)).toEqual([4, 13, 14]);
    expect(calls).toEqual([
      `${F2}/en/racing/2026`,
      `${F2}/en/racing/2026/monte-carlo`,
      `${F2}/en/racing/2026/lusail`,
      `${F2}/en/racing/2026/yas-marina`,
    ]);
    expect(calls.some((u) => u.includes('api.formula1.com') || u.includes('/_next/'))).toBe(false);
  });

  it('turns the local times and their offsets into UTC, keeps the local dates and the F1 round', async () => {
    const rounds = (await f2Source.calendar(2026, fake().deps)) ?? [];
    const monaco = rounds[0];
    expect(monaco).toMatchObject({
      round: 4,
      name: 'Monaco Grand Prix',
      circuitName: 'Circuit de Monaco',
      city: 'Monte Carlo',
      countryCode: 'MC',
      timeZone: 'Europe/Monaco',
      circuitKey: 'monaco',
      status: 'completed',
      sharedWith: [{ series: 'f1', round: 6 }],
      source: { name: 'FIA Formula 2 (fiaformula2.com)', url: `${F2}/en/racing/2026/monte-carlo`, fetchedAt: NOW.toISOString() },
    });
    expect(monaco.sessions.map((s) => [s.id, s.kind, s.name, s.startUtc, s.endUtc, s.localDate])).toEqual([
      ['r4-practice', 'practice', 'Practice', '2026-06-04T13:00:00Z', '2026-06-04T13:45:00Z', '2026-06-04'],
      ['r4-qualifying-a', 'qualifying', 'Qualifying A', '2026-06-05T13:10:00Z', '2026-06-05T13:26:00Z', '2026-06-05'],
      ['r4-qualifying-b', 'qualifying', 'Qualifying B', '2026-06-05T13:34:00Z', '2026-06-05T13:50:00Z', '2026-06-05'],
      ['r4-sprint', 'sprint', 'Sprint Race', '2026-06-06T12:15:00Z', '2026-06-06T13:05:00Z', '2026-06-06'],
      ['r4-feature', 'race', 'Feature Race', '2026-06-07T07:25:00Z', '2026-06-07T08:30:00Z', '2026-06-07'],
    ]);
    expect(monaco.sessions.every((s) => s.timeConfidence === 'confirmed' && s.resultsState === 'none')).toBe(true);
  });

  it("starts Monaco on Thursday, a day before the F1 meeting's own first day", async () => {
    const monaco = ((await f2Source.calendar(2026, fake().deps)) ?? [])[0];
    expect(monaco.startDate).toBe('2026-06-04');
    expect(monaco.endDate).toBe('2026-06-07');
  });

  it('places Lusail by our circuit table and gives each session its status at now', async () => {
    const lusail = ((await f2Source.calendar(2026, fake().deps)) ?? [])[1];
    expect(lusail).toMatchObject({ round: 13, circuitKey: 'losail', city: 'Lusail', countryCode: 'QA', timeZone: 'Asia/Qatar', status: 'live' });
    expect(lusail.sessions.map((s) => [s.id, s.startUtc, s.status])).toEqual([
      ['r13-practice', '2026-11-27T11:00:00Z', 'completed'],
      ['r13-qualifying', '2026-11-27T15:00:00Z', 'completed'],
      ['r13-sprint', '2026-11-28T16:15:00Z', 'upcoming'],
      ['r13-feature', '2026-11-29T12:00:00Z', 'upcoming'],
    ]);
    expect(lusail.sharedWith).toEqual([{ series: 'f1', round: 22 }]);
  });

  it('marks the midnight times of a round not yet timed as placeholders', async () => {
    const yas = ((await f2Source.calendar(2026, fake().deps)) ?? [])[2];
    expect(yas).toMatchObject({ round: 14, circuitKey: 'yas_marina', startDate: '2026-12-04', endDate: '2026-12-06', status: 'scheduled' });
    expect(yas.sessions.every((s) => s.timeConfidence === 'placeholder')).toBe(true);
    expect(sessionOf(yas, 'r14-practice')).toMatchObject({ startUtc: '2026-12-03T20:00:00Z', localDate: '2026-12-04' });
  });

  it('answers null for a season the site has not got (its not-found page, sent as a 500)', async () => {
    const { deps } = fake({ [`${F2}/en/racing/2027`]: NOT_FOUND });
    expect(await f2Source.calendar(2027, deps)).toBeNull();
    expect(await f2Source.calendar(2028, fake().deps)).toBeNull();
  });

  it('throws on a server error that is not the not-found page', async () => {
    const { deps } = fake({ [`${F2}/en/racing/2026`]: { status: 503, text: 'busy' } });
    await expect(f2Source.calendar(2026, deps)).rejects.toThrow(/HTTP 503/);
  });

  it('throws a ShapeError when a listed round has no page, or a round page has no meeting', async () => {
    await expect(f2Source.calendar(2026, fake({ [`${F2}/en/racing/2026/lusail`]: { status: 404, text: '' } }).deps)).rejects.toBeInstanceOf(ShapeError);
    const broken = { status: 200, text: '<html><body><script>self.__next_f.push([1,"0:[\\"$\\",\\"div\\"]\\n"])</script></body></html>' };
    await expect(f2Source.calendar(2026, fake({ [`${F2}/en/racing/2026/monte-carlo`]: broken }).deps)).rejects.toBeInstanceOf(ShapeError);
  });
});

describe('F3 calendar', () => {
  it('reads a meeting split over two flight chunks, and numbers repeated sessions', async () => {
    const rounds = (await f3Source.calendar(2026, fake().deps)) ?? [];
    expect(rounds.map((r) => [r.round, r.circuitKey, r.startDate, r.endDate])).toEqual([
      [2, 'monaco', '2026-06-04', '2026-06-07'],
      [9, 'madring', '2026-09-11', '2026-09-13'],
    ]);
    expect(rounds[0].sessions.map((s) => [s.id, s.startUtc])).toEqual([
      ['r2-practice', '2026-06-04T11:25:00Z'],
      ['r2-qualifying-a', '2026-06-05T09:05:00Z'],
      ['r2-qualifying-b', '2026-06-05T09:29:00Z'],
      ['r2-sprint', '2026-06-06T08:45:00Z'],
      ['r2-feature', '2026-06-07T05:45:00Z'],
    ]);
    expect(rounds[1].sessions.map((s) => [s.id, s.kind])).toEqual([
      ['r9-practice', 'practice'],
      ['r9-qualifying-1', 'qualifying'],
      ['r9-qualifying-2', 'qualifying'],
      ['r9-sprint', 'sprint'],
      ['r9-feature-1', 'race'],
      ['r9-feature-2', 'race'],
    ]);
    expect(rounds[1]).toMatchObject({ city: 'Madrid', timeZone: 'Europe/Madrid', sharedWith: [{ series: 'f1', round: 14 }] });
  });

  it('falls back to the known 2026 round list when the season page is gone', async () => {
    const list = await readRoundList(SITES.f3, 2026, fake({ [`${F3}/en/racing/2026`]: { status: 404, text: '' } }).deps);
    expect(list?.length).toBe(9);
    expect(list?.[1]).toEqual({ round: 2, slug: 'monte-carlo' });
    expect(list?.[8]).toEqual({ round: 9, slug: 'madrid' });
  });
});

describe('the pure parsers', () => {
  it('reads the season page cards', () => {
    expect(parseSeasonRounds(fixture('f2/racing-2026.html'), 2026)).toEqual([
      { round: 4, slug: 'monte-carlo' },
      { round: 13, slug: 'lusail' },
      { round: 14, slug: 'yas-marina' },
    ]);
    expect(parseSeasonRounds('<html><body>nothing</body></html>', 2026)).toEqual([]);
  });

  it('joins the flight chunks in order', () => {
    const text = nextFlightText(fixture('f3/monte-carlo.html'));
    expect(text).toContain('"meetingSessions":');
    expect(text.endsWith('\n')).toBe(true);
  });

  it("uses the page's own zone, without a circuit key, for a circuit not in our table", () => {
    const race = {
      meetingName: 'Test Grand Prix',
      meetingNumber: '30',
      circuitOfficialName: 'Nowhere Ring',
      circuitLocation: 'Nowhere',
      meetingLocation: 'Nowhere',
      meetingIsoCountryName: 'Japan',
      meetingTimezone: 'Asia/Tokyo',
      meetingStartDate: '2026-10-02',
      meetingEndDate: '2026-10-04',
      meetingSessions: [
        { shortName: 'Practice', sessionType: 'Practice', startTime: '2026-10-02T10:00:00', endTime: '2026-10-02T10:45:00', gmtOffset: '+09:00', state: 'upcoming' },
      ],
    };
    const { round, f1Round } = parseRoundPage(roundPageWith(race), { site: SITES.f2, round: 15, url: `${F2}/en/racing/2026/nowhere`, now: NOW });
    expect(round.circuitKey).toBeUndefined();
    expect('circuitKey' in round).toBe(false);
    expect(round).toMatchObject({ timeZone: 'Asia/Tokyo', city: 'Nowhere', country: 'Japan', startDate: '2026-10-02' });
    expect(round.sessions[0]).toMatchObject({ id: 'r15-practice', startUtc: '2026-10-02T01:00:00Z' });
    expect(f1Round).toBe(30);

    const noZone = { ...race, meetingTimezone: '$undefined' };
    expect(() => parseRoundPage(roundPageWith(noZone), { site: SITES.f2, round: 15, url: 'x', now: NOW })).toThrow(ShapeError);
  });

  it('throws a ShapeError on a session without a usable offset', () => {
    const race = {
      meetingName: 'Monaco Grand Prix',
      circuitLocation: 'Monte Carlo',
      meetingSessions: [{ shortName: 'Practice', sessionType: 'Practice', startTime: '2026-06-04T15:00:00', gmtOffset: 'local' }],
    };
    expect(() => parseRoundPage(roundPageWith(race), { site: SITES.f2, round: 4, url: 'x', now: NOW })).toThrow(ShapeError);
  });
});

describe('F2 and F3 results', () => {
  it("reads the latest race's classification from the round page", async () => {
    const { deps, calls } = fake();
    const monaco = ((await f2Source.calendar(2026, deps)) ?? [])[0];
    calls.length = 0;
    const doc = await f2Source.results(2026, monaco, sessionOf(monaco, 'r4-feature'), deps);
    expect(calls).toEqual([`${F2}/en/racing/2026/monte-carlo`]);
    expect(doc).toMatchObject({ state: 'provisional', fetchedAt: NOW.toISOString(), source: { name: f2Source.name, url: `${F2}/en/racing/2026/monte-carlo` } });
    expect(doc?.rows).toHaveLength(6);
    expect(doc?.rows[0]).toEqual({
      position: 1,
      carNumber: '6',
      driverCode: 'TSO',
      driverName: 'Nikola Tsolov',
      team: 'Campos Racing',
      timeOrGap: '1:0:19.442',
      points: 26,
      laps: 42,
    });
    expect(doc?.rows[1]).toMatchObject({ position: 2, driverName: 'Alexander Dunne', timeOrGap: '+9.013s', points: 18 });
    expect(doc?.rows[5]).toMatchObject({ position: null, driverName: 'Rafael Camara', timeOrGap: 'DNF', points: 0, laps: 34 });
  });

  it('answers null for a session the page does not classify (yet)', async () => {
    const { deps } = fake();
    const [monaco, lusail] = (await f2Source.calendar(2026, deps)) ?? [];
    expect(await f2Source.results(2026, lusail, sessionOf(lusail, 'r13-sprint'), deps)).toBeNull();
    expect(await f2Source.results(2026, monaco, sessionOf(monaco, 'r4-sprint'), deps)).toBeNull();
  });

  it("finds the round page through the season page when the round's source is not the site", async () => {
    const { deps, calls } = fake();
    const madrid = ((await f3Source.calendar(2026, deps)) ?? [])[1];
    calls.length = 0;
    const moved: Round = { ...madrid, source: { ...madrid.source, url: 'https://example.com/elsewhere' } };
    const doc = await f3Source.results(2026, moved, sessionOf(madrid, 'r9-feature-2'), deps);
    expect(calls).toEqual([`${F3}/en/racing/2026`, `${F3}/en/racing/2026/madrid`]);
    expect(doc?.rows[0]).toMatchObject({ position: 1, carNumber: '8', driverName: 'Tuukka Taponen', team: 'MP Motorsport', points: 26 });
  });

  it('answers null when the round page is gone', async () => {
    const { deps } = fake();
    const lusail = ((await f2Source.calendar(2026, deps)) ?? [])[1];
    const gone = fake({ [`${F2}/en/racing/2026/lusail`]: { status: 404, text: '' } }).deps;
    expect(await f2Source.results(2026, lusail, sessionOf(lusail, 'r13-feature'), gone)).toBeNull();
  });
});

describe('F2 and F3 standings', () => {
  it('reads both tables, with the last round anyone has a result in', async () => {
    const { drivers, teams } = await f2Source.standings(2026, fake().deps);
    expect(drivers).toMatchObject({ kind: 'drivers', afterRound: 12 });
    expect(drivers?.rows[0]).toEqual({ position: 1, name: 'R. Camara', points: 207 });
    expect(drivers?.rows[1]).toEqual({ position: 2, name: 'N. Tsolov', points: 200 });
    expect(teams).toMatchObject({ kind: 'teams', afterRound: 12 });
    expect(teams?.rows[0]).toEqual({ position: 1, name: 'Campos Racing', points: 333 });

    const f3 = await f3Source.standings(2026, fake().deps);
    expect(f3.drivers?.afterRound).toBe(9);
    expect(f3.drivers?.rows[0]).toEqual({ position: 1, name: 'U. Ugochukwu', points: 159 });
    expect(f3.teams?.rows[0]).toEqual({ position: 1, name: 'Campos Racing', points: 334 });
  });

  it('answers null for a season with no tables, and throws a ShapeError on a page without one', async () => {
    expect(await f2Source.standings(2027, fake().deps)).toEqual({ drivers: null, teams: null });
    expect(() => parseStandingsTable('<html><body><p>no table</p></body></html>', 'drivers')).toThrow(ShapeError);
  });
});

describe('results window', () => {
  it('polls 30 minutes after every session but practice, which the pages never classify', async () => {
    const monaco = ((await f2Source.calendar(2026, fake().deps)) ?? [])[0];
    expect(monaco.sessions.map((s) => resultsWindowMinutes(s))).toEqual([0, 30, 30, 30, 30]);
    expect(f3Source.resultsWindowMinutes).toBe(resultsWindowMinutes);
  });
});
