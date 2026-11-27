import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ShapeError } from '../../service/sync/http.mjs';
import type { Get } from '../../service/sync/http.mjs';
import {
  NAME,
  NAME_WITH_OPENF1,
  parseOpenF1Sessions,
  parseResults,
  parseSchedule,
  parseStandings,
  resultsWindowMinutes,
  source,
} from '../../service/sync/sources/f1.mjs';
import type { Round, Session } from '../../src/lib/raceData';

// The F1 source against recorded answers (test/fixtures/f1, trimmed): Jolpica's 2026 schedule (rounds 17, 21 and 22),
// results and standings, and OpenF1's 2026 sessions. A fake getter maps each URL to its file; any other URL is a 404.
// No network.

const fixture = (name: string) => readFileSync(new URL(`../fixtures/f1/${name}`, import.meta.url), 'utf8');

const SCHEDULE = 'https://api.jolpi.ca/ergast/f1/2026.json?limit=100';
const OPENF1 = 'https://api.openf1.org/v1/sessions?year=2026';

const FILES: Record<string, string> = {
  [SCHEDULE]: 'jolpica-2026.json',
  [OPENF1]: 'openf1-sessions-2026.json',
  'https://api.jolpi.ca/ergast/f1/2026/21/results.json?limit=100': 'jolpica-2026-21-results.json',
  'https://api.jolpi.ca/ergast/f1/2026/17/sprint.json?limit=100': 'jolpica-2026-17-sprint.json',
  'https://api.jolpi.ca/ergast/f1/2026/21/qualifying.json?limit=100': 'jolpica-2026-21-qualifying.json',
  'https://api.jolpi.ca/ergast/f1/2026/22/results.json?limit=100': 'jolpica-2026-22-results-empty.json',
  'https://api.jolpi.ca/ergast/f1/2026/driverstandings.json?limit=100': 'jolpica-2026-driverstandings.json',
  'https://api.jolpi.ca/ergast/f1/2026/constructorstandings.json?limit=100': 'jolpica-2026-constructorstandings.json',
};

/** Friday of the Qatar weekend, after practice 1 and before practice 2. */
const NOW = new Date('2026-11-27T16:30:00Z');

type Answer = { status: number; text: string } | (() => never);

/** A getter over the fixtures; `answers` replaces or adds URLs (a function answer throws, as a network error). */
function fake(answers: Record<string, Answer> = {}) {
  const calls: string[] = [];
  const get: Get = async (url) => {
    calls.push(url);
    const a = answers[url];
    if (typeof a === 'function') return a();
    if (a) return { ...a, url };
    const file = FILES[url];
    return file ? { status: 200, text: fixture(file), url } : { status: 404, text: '{"detail":"Not found."}', url };
  };
  return { deps: { get, now: () => NOW }, calls };
}

const json = (name: string): any => JSON.parse(fixture(name));
const ok = (value: unknown) => ({ status: 200, text: JSON.stringify(value) });

async function calendar(answers: Record<string, Answer> = {}) {
  const rounds = await source.calendar(2026, fake(answers).deps);
  expect(rounds).not.toBeNull();
  return rounds!;
}

const roundOf = (rounds: Round[], n: number) => rounds.find((r) => r.round === n)!;
const sessionOf = (round: Round, slug: string) => round.sessions.find((s) => s.id === `r${round.round}-${slug}`)!;

describe('f1 calendar', () => {
  it('reads the schedule from Jolpica: UTC times, the circuit table, the round fields', async () => {
    const rounds = await calendar();
    expect(rounds.map((r) => r.round)).toEqual([17, 21, 22]);
    const qatar = roundOf(rounds, 22);
    expect(qatar).toMatchObject({
      name: 'Qatar Grand Prix',
      circuitName: 'Lusail International Circuit',
      city: 'Lusail',
      country: 'Qatar',
      countryCode: 'QA',
      timeZone: 'Asia/Qatar',
      circuitKey: 'losail',
      lat: 25.49,
      long: 51.4542,
      startDate: '2026-11-27',
      endDate: '2026-11-29',
      status: 'live',
    });
    expect(qatar.source.url).toContain('api.jolpi.ca/ergast/f1/2026');
    expect(qatar.source.fetchedAt).toBe(NOW.toISOString());
    expect(qatar.sessions.map((s) => s.id)).toEqual(['r22-fp1', 'r22-fp2', 'r22-fp3', 'r22-qualifying', 'r22-race']);
    expect(sessionOf(qatar, 'fp1')).toMatchObject({ kind: 'practice', name: 'Practice 1', startUtc: '2026-11-27T13:30:00Z', status: 'completed' });
    expect(sessionOf(qatar, 'fp2')).toMatchObject({ startUtc: '2026-11-27T17:00:00Z', status: 'upcoming' });
    expect(sessionOf(qatar, 'race')).toMatchObject({ kind: 'race', startUtc: '2026-11-29T16:00:00Z', localDate: '2026-11-29' });
    for (const s of qatar.sessions) expect(s).toMatchObject({ timeConfidence: 'confirmed', resultsState: 'none' });
  });

  it('dates Las Vegas from the UTC instant: the race of "2026-11-22" 04:00Z is Saturday the 21st there', async () => {
    const vegas = roundOf(await calendar(), 21);
    expect(vegas).toMatchObject({ circuitKey: 'vegas', timeZone: 'America/Los_Angeles', countryCode: 'US', status: 'completed' });
    expect(sessionOf(vegas, 'race')).toMatchObject({ startUtc: '2026-11-22T04:00:00Z', localDate: '2026-11-21' });
    expect(sessionOf(vegas, 'fp1')).toMatchObject({ startUtc: '2026-11-20T00:30:00Z', localDate: '2026-11-19' });
    expect([vegas.startDate, vegas.endDate]).toEqual(['2026-11-19', '2026-11-21']);
  });

  it('lists a sprint weekend in time order with the sprint sessions', async () => {
    const singapore = roundOf(await calendar(), 17);
    expect(singapore.circuitKey).toBe('marina_bay');
    expect(singapore.sessions.map((s) => [s.id, s.kind])).toEqual([
      ['r17-fp1', 'practice'],
      ['r17-sprint-qualifying', 'sprint-qualifying'],
      ['r17-sprint', 'sprint'],
      ['r17-qualifying', 'qualifying'],
      ['r17-race', 'race'],
    ]);
  });

  it('merges OpenF1: the session ends and the cancelled flag', async () => {
    const sessions = json('openf1-sessions-2026.json') as Record<string, unknown>[];
    const fp3 = sessions.find((s) => s.circuit_short_name === 'Lusail' && s.session_name === 'Practice 3')!;
    fp3.is_cancelled = true;
    const race = sessions.find((s) => s.circuit_short_name === 'Lusail' && s.session_name === 'Race')!;
    const qatar = roundOf(await calendar({ [OPENF1]: ok(sessions) }), 22);
    expect(qatar.source.name).toBe(NAME_WITH_OPENF1);
    expect(sessionOf(qatar, 'fp3').status).toBe('cancelled');
    expect(sessionOf(qatar, 'race').endUtc).toBe(new Date(String(race.date_end)).toISOString().replace('.000Z', 'Z'));
    expect(sessionOf(qatar, 'fp2').status).toBe('upcoming');
  });

  it('cancels a round whose sessions OpenF1 all marks cancelled', async () => {
    const sessions = (json('openf1-sessions-2026.json') as Record<string, unknown>[]).map((s) =>
      s.circuit_short_name === 'Lusail' ? { ...s, is_cancelled: true } : s,
    );
    const rounds = await calendar({ [OPENF1]: ok(sessions) });
    expect(roundOf(rounds, 22).status).toBe('cancelled');
    expect(roundOf(rounds, 21).status).toBe('completed');
  });

  it('gives the Jolpica calendar alone, with placeholder ends, when OpenF1 refuses (401 while a session is live)', async () => {
    const rounds = await calendar({ [OPENF1]: { status: 401, text: fixture('openf1-sessions-2026-401.json') } });
    const qatar = roundOf(rounds, 22);
    expect(qatar.source.name).toBe(NAME);
    expect(sessionOf(qatar, 'fp1').endUtc).toBe('2026-11-27T14:30:00Z');
    expect(sessionOf(qatar, 'qualifying').endUtc).toBe('2026-11-28T19:00:00Z');
    expect(sessionOf(qatar, 'race').endUtc).toBe('2026-11-29T18:00:00Z');
    expect(sessionOf(roundOf(rounds, 17), 'sprint').endUtc).toBe('2026-10-10T10:00:00Z');
  });

  it('gives the Jolpica calendar when OpenF1 is unreachable, answers another shape or has no sessions for the year', async () => {
    for (const answer of [
      () => {
        throw new TypeError('fetch failed');
      },
      ok({ detail: 'No results found.' }),
      ok([]),
    ] satisfies Answer[]) {
      const rounds = await calendar({ [OPENF1]: answer });
      expect(rounds).toHaveLength(3);
      expect(roundOf(rounds, 22).source.name).toBe(NAME);
    }
  });

  it('answers null for a season Jolpica has not published, without asking OpenF1', async () => {
    const empty = json('jolpica-2026.json');
    empty.MRData.total = '0';
    empty.MRData.RaceTable.Races = [];
    const f = fake({ [SCHEDULE]: ok(empty) });
    expect(await source.calendar(2026, f.deps)).toBeNull();
    expect(f.calls).toEqual([SCHEDULE]);
    expect(await source.calendar(2031, fake().deps)).toBeNull();
  });

  it('throws a ShapeError naming a circuit the table does not know', () => {
    const schedule = json('jolpica-2026.json');
    Object.assign(schedule.MRData.RaceTable.Races[0].Circuit, { circuitId: 'atlantis_ring' });
    schedule.MRData.RaceTable.Races[0].Circuit.Location.locality = 'Atlantis';
    schedule.MRData.RaceTable.Races[0].raceName = 'Atlantis Grand Prix';
    expect(() => parseSchedule(schedule, NOW)).toThrow(ShapeError);
    expect(() => parseSchedule(schedule, NOW)).toThrow(/atlantis_ring/);
  });
});

describe('f1 results', () => {
  async function resultOf(n: number, slug: string) {
    const f = fake();
    const round = roundOf((await source.calendar(2026, f.deps))!, n);
    const session: Session = sessionOf(round, slug);
    f.calls.length = 0;
    return { doc: await source.results(2026, round, session, f.deps), calls: f.calls };
  }

  it('reads a race classification', async () => {
    const { doc, calls } = await resultOf(21, 'race');
    expect(calls).toEqual(['https://api.jolpi.ca/ergast/f1/2026/21/results.json?limit=100']);
    expect(doc).toMatchObject({ state: 'provisional', fetchedAt: NOW.toISOString(), source: { name: NAME, url: calls[0] } });
    expect(doc!.rows[0]).toEqual({
      position: 1,
      carNumber: '3',
      driverCode: 'VER',
      driverName: 'Max Verstappen',
      team: 'Red Bull',
      timeOrGap: '1:27:39.624',
      points: 25,
      laps: 50,
    });
    expect(doc!.rows[1]).toMatchObject({ position: 2, driverCode: 'NOR', timeOrGap: '+0.639', points: 18 });
    // the unclassified: no position, the status as the time
    expect(doc!.rows.slice(5).map((r) => [r.position, r.timeOrGap])).toEqual([
      [null, 'Retired'],
      [null, 'Did not start'],
    ]);
  });

  it('reads a sprint classification', async () => {
    const { doc, calls } = await resultOf(17, 'sprint');
    expect(calls).toEqual(['https://api.jolpi.ca/ergast/f1/2026/17/sprint.json?limit=100']);
    expect(doc!.rows[0]).toMatchObject({ position: 1, driverCode: 'VER', timeOrGap: '39:48.162', points: 8, laps: 20 });
    expect(doc!.rows).toHaveLength(6);
  });

  it('reads a qualifying classification: the time of the last part reached', async () => {
    const { doc } = await resultOf(21, 'qualifying');
    expect(doc!.rows[0]).toEqual({
      position: 1,
      carNumber: '12',
      driverCode: 'ANT',
      driverName: 'Andrea Kimi Antonelli',
      team: 'Mercedes',
      timeOrGap: '1:33.893',
    });
    expect(doc!.rows.slice(5).map((r) => [r.position, r.timeOrGap])).toEqual([
      [11, '1:35.197'],
      [17, '1:36.220'],
    ]);
  });

  it('answers null while Jolpica has no result: an empty Races list or a 404', async () => {
    expect((await resultOf(22, 'race')).doc).toBeNull();
    expect((await resultOf(22, 'qualifying')).doc).toBeNull();
  });

  it('asks nothing for practice and sprint qualifying (Jolpica keeps neither)', async () => {
    for (const [n, slug] of [
      [22, 'fp1'],
      [17, 'sprint-qualifying'],
    ] as const) {
      const { doc, calls } = await resultOf(n, slug);
      expect(doc).toBeNull();
      expect(calls).toEqual([]);
    }
  });

  it('throws a ShapeError when the answer is about another round', () => {
    expect(() => parseResults(json('jolpica-2026-21-results.json'), 'race', { url: 'u', fetchedAt: 'f', round: 20 })).toThrow(ShapeError);
  });
});

describe('f1 standings', () => {
  it('reads the drivers and the teams', async () => {
    const { drivers, teams } = await source.standings(2026, fake().deps);
    expect(drivers).toMatchObject({ kind: 'drivers', afterRound: 21 });
    expect(drivers!.rows).toHaveLength(5);
    expect(drivers!.rows[0]).toEqual({ position: 1, name: 'Andrea Kimi Antonelli', team: 'Mercedes', points: 402 });
    expect(teams).toMatchObject({ kind: 'teams', afterRound: 21 });
    expect(teams!.rows[0]).toEqual({ position: 1, name: 'Mercedes', points: 666 });
  });

  it('answers null for a table Jolpica does not have', async () => {
    const empty = json('jolpica-2026-driverstandings.json');
    empty.MRData.StandingsTable.StandingsLists = [];
    expect(parseStandings(empty, 'drivers')).toBeNull();
    expect(await source.standings(2031, fake().deps)).toEqual({ drivers: null, teams: null });
  });
});

describe('f1 shapes and windows', () => {
  it('throws a ShapeError when an answer lacks the MRData paths', async () => {
    expect(() => parseSchedule({ MRData: { RaceTable: {} } }, NOW)).toThrow(ShapeError);
    expect(() => parseSchedule({ error: 'gone' }, NOW)).toThrow(/MRData/);
    expect(() => parseResults({ MRData: {} }, 'race', { url: 'u', fetchedAt: 'f' })).toThrow(/MRData\.RaceTable/);
    const noRows = json('jolpica-2026-21-results.json');
    delete noRows.MRData.RaceTable.Races[0].Results;
    expect(() => parseResults(noRows, 'race', { url: 'u', fetchedAt: 'f' })).toThrow(ShapeError);
    expect(() => parseStandings({ MRData: { StandingsTable: { StandingsLists: [{ round: '21' }] } } }, 'teams')).toThrow(ShapeError);
    expect(() => parseOpenF1Sessions({ detail: 'x' })).toThrow(ShapeError);
    await expect(source.calendar(2026, fake({ [SCHEDULE]: { status: 200, text: '<html>moved</html>' } }).deps)).rejects.toThrow(ShapeError);
  });

  it('throws on a status other than 200 and 404', async () => {
    await expect(source.calendar(2026, fake({ [SCHEDULE]: { status: 429, text: '' } }).deps)).rejects.toThrow(/429/);
  });

  it('polls results 180 minutes after a race or sprint, 60 after a qualifying, never after practice', () => {
    const at = (kind: Session['kind']) => resultsWindowMinutes({ kind } as Session);
    expect([at('race'), at('sprint'), at('qualifying'), at('sprint-qualifying'), at('practice')]).toEqual([180, 180, 60, 60, 0]);
    expect(source.resultsWindowMinutes).toBe(resultsWindowMinutes);
  });
});
