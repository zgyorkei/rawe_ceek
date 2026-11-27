import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShapeError } from '../../service/sync/http.mjs';
import type { Get } from '../../service/sync/http.mjs';
import {
  NAME,
  parseCalendar,
  parseNextData,
  parseStandings,
  resultsWindowMinutes,
  sessionKinds,
  sessionSlugs,
  source,
} from '../../service/sync/sources/f1academy.mjs';
import type { Round, Session } from '../../src/lib/raceData';

// The F1 Academy source against recorded pages (test/fixtures/f1academy, trimmed): the 2026 calendar (rounds 2, 3
// and 6), the 2025 calendar (rounds 1 and 2), the Las Vegas results page and the two standings pages. A fake getter
// maps each URL to its file; any other URL is a 404. No network.

const fixture = (name: string) => readFileSync(new URL(`../fixtures/f1academy/${name}`, import.meta.url), 'utf8');

const BASE = 'https://www.f1academy.com';
const CALENDAR = `${BASE}/Racing-Series/Calendar`;

const FILES: Record<string, string> = {
  [CALENDAR]: 'calendar.html',
  [`${CALENDAR}?seasonid=3`]: 'calendar-2025.html',
  [`${BASE}/Racing-Series/Results?raceid=28`]: 'results-28.html',
  [`${BASE}/Racing-Series/Standings/Driver`]: 'standings-driver.html',
  [`${BASE}/Racing-Series/Standings/Team`]: 'standings-team.html',
};

/** The week after the Las Vegas round, the season's last. */
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

const sessionOf = (round: Round, id: string): Session => {
  const s = round.sessions.find((x) => x.id === id);
  if (!s) throw new Error(`no session ${id}`);
  return s;
};

async function calendar2026() {
  const rounds = await source.calendar(2026, fake().deps);
  if (!rounds) throw new Error('no 2026 calendar');
  return rounds;
}

describe('F1 Academy calendar', () => {
  it('reads the current season from the calendar page alone', async () => {
    const { deps, calls } = fake();
    const rounds = (await source.calendar(2026, deps)) ?? [];
    expect(calls).toEqual([CALENDAR]);
    expect(rounds.map((r) => [r.round, r.name, r.circuitKey, r.timeZone, r.startDate, r.endDate, r.status])).toEqual([
      [2, 'Montreal', 'villeneuve', 'America/Toronto', '2026-05-22', '2026-05-24', 'completed'],
      [3, 'Silverstone', 'silverstone', 'Europe/London', '2026-07-03', '2026-07-05', 'completed'],
      [6, 'Las Vegas', 'vegas', 'America/Los_Angeles', '2026-11-19', '2026-11-21', 'completed'],
    ]);
    expect(rounds[0]).toMatchObject({
      circuitName: 'Circuit Gilles-Villeneuve',
      city: 'Montreal',
      country: 'Canada',
      countryCode: 'CA',
      source: { name: NAME, url: `${BASE}/Racing-Series/Results?raceid=24`, fetchedAt: NOW.toISOString() },
    });
    expect(calls.some((u) => u.includes('/_next/data/'))).toBe(false);
  });

  it("corrects the site's wrong summer offsets with the circuit's zone", async () => {
    const [montreal, silverstone] = await calendar2026();
    // printed as 09:00-05:00 and 07:45+00:00: Montreal is on -04:00 in May, Silverstone on +01:00 in July
    expect(sessionOf(montreal, 'r2-practice')).toMatchObject({ startUtc: '2026-05-22T13:00:00Z', endUtc: '2026-05-22T13:40:00Z', localDate: '2026-05-22' });
    expect(sessionOf(silverstone, 'r3-practice')).toMatchObject({ startUtc: '2026-07-03T06:45:00Z', localDate: '2026-07-03' });
    expect(sessionOf(silverstone, 'r3-feature')).toMatchObject({ startUtc: '2026-07-05T09:00:00Z' });
  });

  it('keeps the local date of a session that ends up on the next UTC day', async () => {
    const vegas = (await calendar2026())[2];
    expect(sessionOf(vegas, 'r6-qualifying')).toMatchObject({ startUtc: '2026-11-20T05:30:00Z', localDate: '2026-11-19' });
    expect(vegas.countryCode).toBe('US');
  });

  it('names and kinds the sessions: the feature race is the race, the others sprints', async () => {
    const [montreal, , vegas] = await calendar2026();
    expect(montreal.sessions.map((s) => [s.id, s.kind, s.name])).toEqual([
      ['r2-practice', 'practice', 'Free Practice'],
      ['r2-qualifying-1', 'qualifying', 'Qualifying 1'],
      ['r2-qualifying-2', 'qualifying', 'Qualifying 2'],
      ['r2-opening', 'sprint', 'Opening Race'],
      ['r2-reverse-grid', 'sprint', 'Reverse Grid Race'],
      ['r2-feature', 'race', 'Feature Race'],
    ]);
    expect(vegas.sessions.every((s) => s.timeConfidence === 'confirmed' && s.resultsState === 'none' && s.status === 'completed')).toBe(true);
  });

  it('reads another season through its id, and answers null for a season the site has not got', async () => {
    const { deps, calls } = fake();
    const rounds = (await source.calendar(2025, deps)) ?? [];
    expect(calls).toEqual([CALENDAR, `${CALENDAR}?seasonid=3`]);
    expect(rounds.map((r) => [r.round, r.circuitKey])).toEqual([
      [1, 'shanghai'],
      [2, 'jeddah'],
    ]);
    expect(rounds[0].sessions.map((s) => [s.id, s.kind, s.startUtc])).toEqual([
      ['r1-practice', 'practice', '2025-03-21T01:10:00Z'],
      ['r1-qualifying', 'qualifying', '2025-03-21T06:05:00Z'],
      ['r1-race-1', 'sprint', '2025-03-22T05:50:00Z'],
      ['r1-race-2', 'race', '2025-03-23T02:45:00Z'],
    ]);
    expect(await source.calendar(2030, fake().deps)).toBeNull();
  });

  it('throws a ShapeError when the site answers another season than the one asked for', async () => {
    const { deps } = fake({ [`${CALENDAR}?seasonid=3`]: { status: 200, text: fixture('calendar.html') } });
    await expect(source.calendar(2025, deps)).rejects.toBeInstanceOf(ShapeError);
  });

  it('throws a ShapeError on a page without its data, or a circuit not in our table', async () => {
    const bare = { status: 200, text: '<html><body><div id="__next"></div></body></html>' };
    await expect(source.calendar(2026, fake({ [CALENDAR]: bare }).deps)).rejects.toBeInstanceOf(ShapeError);
    const unknown = fixture('calendar.html')
      .replace(/"CircuitShortName":"Montreal"/g, '"CircuitShortName":"Nowhere"')
      .replace(/"CircuitName":"Circuit Gilles-Villeneuve"/g, '"CircuitName":"Nowhere Ring"')
      .replace(/"CountryName":"Canada"/g, '"CountryName":"Atlantis"');
    expect(() => parseCalendar(unknown, NOW)).toThrow(ShapeError);
  });

  it('throws on a server error', async () => {
    await expect(source.calendar(2026, fake({ [CALENDAR]: { status: 502, text: '' } }).deps)).rejects.toThrow(/HTTP 502/);
  });
});

describe('F1 Academy results', () => {
  it("reads every session's classification from the round's results page", async () => {
    const { deps, calls } = fake();
    const vegas = (await calendar2026())[2];
    const fp = await source.results(2026, vegas, sessionOf(vegas, 'r6-practice'), deps);
    expect(calls).toEqual([`${BASE}/Racing-Series/Results?raceid=28`]);
    expect(fp).toMatchObject({ state: 'provisional', fetchedAt: NOW.toISOString(), source: { name: NAME, url: `${BASE}/Racing-Series/Results?raceid=28` } });
    expect(fp?.rows[0]).toEqual({ position: 1, carNumber: '21', driverCode: 'PAL', driverName: 'Alisha Palmowski', team: 'Campos Racing', timeOrGap: '2:24.509', laps: 8 });
    expect(fp?.rows[1]).toMatchObject({ driverName: 'Lisa Billard', timeOrGap: '2:25.598' });

    const rg = await source.results(2026, vegas, sessionOf(vegas, 'r6-reverse-grid'), deps);
    expect(rg?.rows.map((r) => [r.position, r.driverName, r.timeOrGap])).toEqual([
      [1, 'Alba Larsen', '32:21.861'],
      [2, 'Alisha Palmowski', '+0.316'],
      [3, 'Megan Bruce', '+4.374'],
      [4, 'Jade Jacquet', '+5.791'],
      [5, 'Ella Stevens', '+5.916'],
      [null, 'Mathilda Paatz', 'DNF'],
    ]);

    const feature = await source.results(2026, vegas, sessionOf(vegas, 'r6-feature'), deps);
    expect(feature?.rows[0]).toMatchObject({ position: 1, driverName: 'Alisha Palmowski', timeOrGap: '30:04.487' });
    expect(feature?.rows[5]).toMatchObject({ position: null, driverName: 'Natalia Granada', timeOrGap: 'DNF', laps: 4 });
  });

  it('answers null while a results page is missing or holds no rows', async () => {
    const [montreal, , vegas] = await calendar2026();
    expect(await source.results(2026, montreal, sessionOf(montreal, 'r2-feature'), fake().deps)).toBeNull();

    const empty = fixture('results-28.html').replace(/"Results":\[[^\]]*\]/g, '"Results":[]');
    const deps = fake({ [`${BASE}/Racing-Series/Results?raceid=28`]: { status: 200, text: empty } }).deps;
    expect(await source.results(2026, vegas, sessionOf(vegas, 'r6-feature'), deps)).toBeNull();
  });

  it('finds the race id through the calendar when the round was stored without it', async () => {
    const { deps, calls } = fake();
    const vegas = (await calendar2026())[2];
    const bare: Round = { ...vegas, source: { ...vegas.source, url: BASE } };
    const doc = await source.results(2026, bare, sessionOf(vegas, 'r6-qualifying'), deps);
    expect(calls).toEqual([CALENDAR, `${BASE}/Racing-Series/Results?raceid=28`]);
    expect(doc?.rows[0]).toMatchObject({ driverName: 'Alisha Palmowski', timeOrGap: '2:09.915', laps: 12 });
  });
});

describe('F1 Academy standings', () => {
  it('reads both standings pages', async () => {
    const { deps, calls } = fake();
    const { drivers, teams } = await source.standings(2026, deps);
    expect(calls).toEqual([`${BASE}/Racing-Series/Standings/Driver`, `${BASE}/Racing-Series/Standings/Team`]);
    expect(drivers).toMatchObject({ kind: 'drivers', afterRound: 6 });
    expect(drivers?.rows.map((r) => [r.position, r.name, r.team, r.points])).toEqual([
      [1, 'Alisha Palmowski', 'Campos Racing', 209],
      [2, 'Nina Gademan', 'MP Motorsport', 134],
      [3, 'Emma Felbermayr', 'Rodin Motorsport', 125],
      [4, 'Alba Larsen', 'MP Motorsport', 104],
      [5, 'Payton Westcott', 'PREMA Racing', 82],
    ]);
    expect(teams).toMatchObject({ kind: 'teams', afterRound: 6 });
    expect(teams?.rows[0]).toEqual({ position: 1, name: 'Campos Racing', points: 298 });
    expect(teams?.rows[1]).toEqual({ position: 2, name: 'MP Motorsport', points: 250 });
  });

  it('asks for another season with its camel case id, and answers nulls for a season the site has not got', async () => {
    const { deps, calls } = fake();
    expect(await source.standings(2030, deps)).toEqual({ drivers: null, teams: null });
    expect(calls).toEqual([`${BASE}/Racing-Series/Standings/Driver`]);

    const other = fake();
    await expect(source.standings(2025, other.deps)).resolves.toEqual({ drivers: null, teams: null });
    expect(other.calls).toEqual([`${BASE}/Racing-Series/Standings/Driver`, `${BASE}/Racing-Series/Standings/Driver?seasonId=3`]);
  });

  it('answers null for a table nobody has points in yet', () => {
    const none = fixture('standings-team.html').replace(/"TotalPoints":\d+,"RacePoints":\[[^"]*?\]\]/g, '"TotalPoints":0,"RacePoints":[]');
    expect(parseStandings(none, 'teams')).toBeNull();
  });
});

describe('the pure helpers', () => {
  it('reads the page props', () => {
    expect(parseNextData(fixture('calendar.html'))).toHaveProperty('pageData.SeasonId', 4);
    expect(() => parseNextData('<script id="__NEXT_DATA__" type="application/json">{oops</script>')).toThrow(ShapeError);
  });

  it('makes slugs and kinds from the session names', () => {
    expect(sessionSlugs(['Free Practice', 'Qualifying', 'Race 1', 'Race 2', 'Race'])).toEqual(['practice', 'qualifying', 'race-1', 'race-2', 'race']);
    expect(sessionSlugs(['Race', 'Race'])).toEqual(['race-1', 'race-2']);
    expect(sessionKinds([{ code: 'RESULT', name: 'Race 1' }, { code: 'RESULT', name: 'Race 2' }])).toEqual(['sprint', 'race']);
  });

  it('polls results 30 minutes after every session, practice too', async () => {
    const montreal = (await calendar2026())[0];
    expect(montreal.sessions.map((s) => resultsWindowMinutes(s))).toEqual([30, 30, 30, 30, 30, 30]);
    expect(source.resultsWindowMinutes).toBe(resultsWindowMinutes);
  });
});
