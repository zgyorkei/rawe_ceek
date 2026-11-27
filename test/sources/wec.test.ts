import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { ShapeError } from '../../service/sync/http.mjs';
import type { Get } from '../../service/sync/http.mjs';
import type { Repair, SourceDeps } from '../../service/sync/source.mjs';
import {
  NAME,
  REPAIR_MAX,
  icsEvents,
  icsUrl,
  parseCrews,
  parseIcs,
  parseResults,
  parseSeasonPage,
  parseStandings,
  racePageUrl,
  repairText,
  resultsUrl,
  resultsWindowMinutes,
  seasonUrl,
  sessionFromName,
  source,
  standingsUrl,
} from '../../service/sync/sources/wec.mjs';
import type { Round, Session } from '../../src/lib/raceData';

// The WEC source against pages of fiawec.com read on 2026-11-27 (test/fixtures/wec, trimmed): the 2026 and 2027 season
// pages, three 2026 ICS files (Imola and Monza with TZID times, Le Mans with "Z" times), the 2027 Qatar race page,
// Monza's results (the race and Hyperpole - HYPERCAR) and the classification page. A fake getter maps each URL to its
// file; any other URL is a 404 (as fiawec.com answers for an ICS whose times are not out). No network; the AI repair
// step is a fake.

const fixture = (name: string) => readFileSync(new URL(`../fixtures/wec/${name}`, import.meta.url), 'utf8');

const NOW = new Date('2026-11-27T12:00:00Z');

const FILES: Record<string, string> = {
  [seasonUrl(2026)]: 'season-2026.html',
  [seasonUrl(2027)]: 'season-2027.html',
  [icsUrl(4948)]: 'calendar-4948.ics',
  [icsUrl(4951)]: 'calendar-4951.ics',
  [icsUrl(5066)]: 'calendar-5066.ics',
  [racePageUrl('qatar-1812km-2027')]: 'race-qatar-1812km-2027.html',
  [resultsUrl(5066)]: 'resultats-5066.html',
  [resultsUrl(5066, 8291)]: 'resultats-5066-8291.html',
  [standingsUrl()]: 'classification-2026.html',
  [standingsUrl(4175)]: 'classification-2026.html',
};

/** A getter over the fixtures (plus `extra`, URL to text), recording what it was asked. */
function fake(extra: Record<string, string> = {}, repair?: Repair) {
  const calls: string[] = [];
  const get: Get = async (url) => {
    calls.push(url);
    const text = url in extra ? extra[url] : FILES[url] === undefined ? undefined : fixture(FILES[url]);
    return text === undefined ? { status: 404, text: 'Not Found', url } : { status: 200, text, url };
  };
  const deps: SourceDeps = repair ? { get, now: () => NOW, repair } : { get, now: () => NOW };
  return { deps, calls };
}

const roundOf = (rounds: Round[] | null, n: number) => {
  const r = rounds?.find((x) => x.round === n);
  if (!r) throw new Error(`no round ${n}`);
  return r;
};
const sessionOf = (round: Round, id: string) => {
  const s = round.sessions.find((x) => x.id === id);
  if (!s) throw new Error(`no session ${id}`);
  return s;
};

/** True when a value holds an undefined field anywhere (Firestore refuses those). */
const hasUndefined = (v: unknown): boolean =>
  v === undefined || (typeof v === 'object' && v !== null && Object.values(v).some((x) => hasUndefined(x)));

async function calendar2026() {
  return source.calendar(2026, fake().deps);
}

describe('the season page', () => {
  it('lists the 2026 rounds from the race list, the prologue left out, with the race ids of the standings selector', () => {
    const entries = parseSeasonPage(fixture('season-2026.html'), 2026);
    expect(entries).toHaveLength(8);
    expect(entries.some((e) => /prologue/.test(e.slug))).toBe(false);
    expect(entries[0]).toEqual({
      slug: '6-hours-of-imola-2026',
      name: '6 Hours of Imola',
      nameFromSlug: false,
      countryCode: 'IT',
      raceDay: null,
      raceId: 4948,
    });
    expect(entries[2]).toMatchObject({ slug: '24-hours-of-le-mans-2026', countryCode: 'FR', raceId: 4951 });
    expect(entries[7]).toMatchObject({ slug: '6-hours-of-monza-2026', name: '6 Hours of Monza', raceId: 5066 });
  });

  it('lists 2027 from the season overview while its race list is empty, with the race days', () => {
    const entries = parseSeasonPage(fixture('season-2027.html'), 2027);
    expect(entries).toHaveLength(9);
    expect(entries[0]).toEqual({
      slug: 'qatar-1812km-2027',
      name: 'Qatar 1812km',
      nameFromSlug: true,
      countryCode: 'QA',
      raceDay: '2027-03-27',
      raceId: null,
    });
    expect(entries[1]).toMatchObject({ slug: '6-hours-of-imola-2027', raceDay: '2027-04-11' });
    expect(entries.map((e) => e.raceId)).toEqual(Array(9).fill(null));
  });

  it('throws a ShapeError for a page with neither a race list nor a season overview', () => {
    expect(() => parseSeasonPage('<html><body><main></main></body></html>', 2026)).toThrow(ShapeError);
  });
});

describe('session names', () => {
  it('reads the kind, the id slug and the class', () => {
    expect(sessionFromName('6 Hours of Monza - Qualifying - HYPERCAR')).toEqual({
      kind: 'qualifying',
      slug: 'q-hypercar',
      name: 'Qualifying - HYPERCAR',
      class: 'hypercar',
    });
    expect(sessionFromName('24 Hours of Le Mans - Hyperpole 1 - LMP2 & LMGT3')).toEqual({
      kind: 'hyperpole',
      slug: 'hp1-lmp2-lmgt3',
      name: 'Hyperpole 1 - LMP2 & LMGT3',
      class: 'none',
    });
    expect(sessionFromName('Free Practice 1')).toMatchObject({ kind: 'practice', slug: 'fp1', class: 'none' });
    expect(sessionFromName('24 Hours of Le Mans - Warm-up')).toMatchObject({ kind: 'practice', slug: 'warm-up' });
    expect(sessionFromName('6 Hours of Monza - Race')).toMatchObject({ kind: 'race', slug: 'race', class: 'none' });
    expect(sessionFromName('Autograph session')).toBeNull();
  });
});

describe('the calendar', () => {
  it('reads each round from its ICS (TZID local times), the round with neither an ICS nor a date left out', async () => {
    const { deps, calls } = fake();
    const rounds = await source.calendar(2026, deps);
    // Spa, Sao Paulo, Lone Star, Fuji and Barcelona have no fixture: a 404 ICS and a 404 race page, no date at all
    expect(rounds?.map((r) => r.round)).toEqual([1, 3, 8]);
    expect(calls).toContain(icsUrl(4949));
    expect(calls).toContain(racePageUrl('totalenergies-6-hours-of-spa-francorchamps-2026'));

    const monza = roundOf(rounds, 8);
    expect(monza).toMatchObject({
      name: '6 Hours of Monza',
      circuitName: 'Autodromo Nazionale Monza',
      city: 'Monza',
      country: 'Italy',
      countryCode: 'IT',
      timeZone: 'Europe/Rome',
      circuitKey: 'monza',
      lat: null,
      long: null,
      startDate: '2026-11-06',
      endDate: '2026-11-08',
      status: 'completed',
      source: { name: NAME, url: icsUrl(5066), fetchedAt: NOW.toISOString() },
    });
    expect(monza.sessions.map((s) => s.id)).toEqual([
      'r8-fp1',
      'r8-fp2',
      'r8-fp3',
      'r8-q-lmgt3',
      'r8-hp-lmgt3',
      'r8-q-hypercar',
      'r8-hp-hypercar',
      'r8-race',
    ]);
    // Europe/Rome in November is UTC+1
    expect(sessionOf(monza, 'r8-race')).toEqual({
      id: 'r8-race',
      kind: 'race',
      name: 'Race',
      class: 'none',
      startUtc: '2026-11-08T10:00:00Z',
      endUtc: '2026-11-08T16:00:00Z',
      localDate: '2026-11-08',
      timeConfidence: 'confirmed',
      status: 'completed',
      resultsState: 'none',
    } satisfies Session);
    expect(sessionOf(monza, 'r8-q-hypercar')).toMatchObject({ kind: 'qualifying', class: 'hypercar', name: 'Qualifying - HYPERCAR' });
    expect(sessionOf(monza, 'r8-hp-lmgt3')).toMatchObject({ kind: 'hyperpole', class: 'lmgt3' });
    expect(sessionOf(monza, 'r8-fp1')).toMatchObject({ kind: 'practice', startUtc: '2026-11-06T09:30:00Z' });

    // the same zone in April is UTC+2 (summer time): 13:00 local is 11:00Z
    const imola = roundOf(rounds, 1);
    expect(imola).toMatchObject({ circuitKey: 'imola', startDate: '2026-04-17', endDate: '2026-04-19' });
    expect(sessionOf(imola, 'r1-race')).toMatchObject({ startUtc: '2026-04-19T11:00:00Z', endUtc: '2026-04-19T17:00:00Z' });

    expect(rounds?.some((r) => hasUndefined(r))).toBe(false);
  });

  it('reads the "Z" times of the Le Mans ICS as the circuit clock', async () => {
    const leMans = roundOf(await calendar2026(), 3);
    expect(leMans).toMatchObject({ circuitKey: 'le_mans', timeZone: 'Europe/Paris', startDate: '2026-06-10', endDate: '2026-06-13' });
    expect(leMans.sessions).toHaveLength(12);
    // 16:00 on the ICS is the 16:00 start in Le Mans (UTC+2), and the race ends 24 hours later
    expect(sessionOf(leMans, 'r3-race')).toMatchObject({ startUtc: '2026-06-13T14:00:00Z', endUtc: '2026-06-14T14:00:00Z', localDate: '2026-06-13' });
    // the night practice ends at midnight local, still on its own day
    expect(sessionOf(leMans, 'r3-fp2')).toMatchObject({ startUtc: '2026-06-10T20:00:00Z', endUtc: '2026-06-10T22:00:00Z', localDate: '2026-06-10' });
    expect(sessionOf(leMans, 'r3-fp4')).toMatchObject({ localDate: '2026-06-11' });
    expect(sessionOf(leMans, 'r3-hp1-lmp2-lmgt3')).toMatchObject({ kind: 'hyperpole', class: 'none' });
    expect(sessionOf(leMans, 'r3-hp1-hypercar')).toMatchObject({ kind: 'hyperpole', class: 'hypercar' });
    expect(sessionOf(leMans, 'r3-q-lmp2-lmgt3')).toMatchObject({ kind: 'qualifying', name: 'Qualifying - LMP2 & LMGT3' });
    expect(sessionOf(leMans, 'r3-warm-up')).toMatchObject({ kind: 'practice', name: 'Warm-up' });
  });

  it('keeps a 2027 round whose ICS is a 404: the race page programme, else the race day with no sessions', async () => {
    const { deps, calls } = fake();
    const rounds = await source.calendar(2027, deps);
    expect(rounds?.map((r) => r.round)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(calls).toContain(icsUrl(5043));

    const qatar = roundOf(rounds, 1);
    expect(qatar).toMatchObject({
      name: 'Qatar 1812km',
      circuitKey: 'losail',
      timeZone: 'Asia/Qatar',
      countryCode: 'QA',
      startDate: '2027-03-25',
      endDate: '2027-03-27',
      status: 'scheduled',
      source: { url: racePageUrl('qatar-1812km-2027') },
    });
    expect(qatar.sessions).toHaveLength(8);
    // a session with a day only: 'tbc' at the circuit's midday (UTC+3)
    expect(sessionOf(qatar, 'r1-fp1')).toMatchObject({
      startUtc: '2027-03-25T09:00:00Z',
      endUtc: null,
      localDate: '2027-03-25',
      timeConfidence: 'tbc',
      status: 'upcoming',
    });
    expect(sessionOf(qatar, 'r1-hp-hypercar')).toMatchObject({ localDate: '2027-03-26', timeConfidence: 'tbc' });
    // the race has its timestamp
    expect(sessionOf(qatar, 'r1-race')).toMatchObject({ startUtc: '2027-03-27T10:00:00Z', endUtc: null, timeConfidence: 'confirmed' });

    const imola = roundOf(rounds, 2);
    expect(imola).toMatchObject({ name: '6 Hours of Imola', circuitKey: 'imola', startDate: '2027-04-11', endDate: '2027-04-11', status: 'scheduled' });
    expect(imola.sessions).toEqual([]);

    // "Lone Star Le Mans" is Austin, not Le Mans
    expect(roundOf(rounds, 7)).toMatchObject({ circuitKey: 'americas', timeZone: 'America/Chicago', countryCode: 'US' });
    expect(roundOf(rounds, 9)).toMatchObject({ circuitKey: 'bahrain', timeZone: 'Asia/Bahrain', startDate: '2027-11-06' });
    expect(rounds?.some((r) => hasUndefined(r))).toBe(false);
  });

  it('gives null for a season the site does not have', async () => {
    expect(await source.calendar(2028, fake().deps)).toBeNull();
  });
});

describe('the ICS', () => {
  const ics = (...events: string[]) =>
    ['BEGIN:VCALENDAR', 'VERSION:2.0', ...events.flatMap((e) => ['BEGIN:VEVENT', e, 'END:VEVENT']), 'END:VCALENDAR', ''].join('\r\n');

  it('reads TZID times across the end of summer time, folded lines and escaped commas', () => {
    const text = ics(
      'UID:1\r\nSUMMARY:Test\\, Race - Free Practice 1\r\nDTSTART;TZID=Europe/Paris:20261024T120000\r\nDTEND;TZID=Europe/Paris:20261024T130000',
      'UID:2\r\nSUMMARY:Test Race - Qualif\r\n ying - HYPERCAR\r\nDTSTART;TZID=Europe/Paris:20261025T120000\r\nDTEND;TZID=Europe/Paris:20261025T121500',
      'UID:3\r\nSUMMARY:Test Race - Race\r\nDTSTART;VALUE=DATE:20261026',
    );
    expect(icsEvents(text)[0].summary).toBe('Test, Race - Free Practice 1');
    const sessions = parseIcs(text, 'Europe/Paris', 4, NOW);
    expect(sessions.map((s) => [s.id, s.startUtc, s.endUtc, s.localDate, s.timeConfidence])).toEqual([
      ['r4-fp1', '2026-10-24T10:00:00Z', '2026-10-24T11:00:00Z', '2026-10-24', 'confirmed'],
      ['r4-q-hypercar', '2026-10-25T11:00:00Z', '2026-10-25T11:15:00Z', '2026-10-25', 'confirmed'],
      ['r4-race', '2026-10-26T11:00:00Z', null, '2026-10-26', 'tbc'],
    ]);
  });

  it('reads a "Z" time as the circuit clock and keeps a TZID over the circuit zone', () => {
    const text = ics(
      'SUMMARY:Lone Star Le Mans - Race\r\nDTSTART:20260906T120000Z\r\nDTEND:20260906T180000Z',
      'SUMMARY:Lone Star Le Mans - Free Practice 1\r\nDTSTART;TZID=Europe/Paris:20260904T100000',
      'SUMMARY:Lone Star Le Mans - Free Practice 2\r\nDTSTART:20260904T150000\r\nSTATUS:CANCELLED',
    );
    const sessions = parseIcs(text, 'America/Chicago', 6, NOW);
    expect(sessions.map((s) => [s.id, s.startUtc, s.status])).toEqual([
      ['r6-fp1', '2026-09-04T08:00:00Z', 'completed'],
      ['r6-fp2', '2026-09-04T20:00:00Z', 'cancelled'],
      ['r6-race', '2026-09-06T17:00:00Z', 'completed'],
    ]);
  });

  it('throws a ShapeError for an answer that is not an iCalendar file', () => {
    expect(() => parseIcs('<html>Not found</html>', 'Europe/Rome', 1, NOW)).toThrow(ShapeError);
  });
});

describe('the results', () => {
  it("reads the race from the results page, with each car's crew from the classification page", async () => {
    const monza = roundOf(await calendar2026(), 8);
    const { deps, calls } = fake();
    const doc = await source.results(2026, monza, sessionOf(monza, 'r8-race'), deps);
    expect(doc?.state).toBe('final');
    expect(doc?.fetchedAt).toBe(NOW.toISOString());
    expect(doc?.source).toEqual({ name: NAME, url: resultsUrl(5066) });
    expect(doc?.rows).toHaveLength(17);
    expect(doc?.rows[0]).toEqual({
      position: 1,
      carNumber: '38',
      driverName: 'EARL BAMBER, SÉBASTIEN BOURDAIS',
      team: 'CADILLAC HERTZ TEAM JOTA',
      timeOrGap: '6:01:33.199',
      laps: 191,
      class: 'hypercar',
    });
    expect(doc?.rows[1]).toMatchObject({ position: 2, carNumber: '36', timeOrGap: '5.607', driverName: '' });
    expect(doc?.rows[9]).toMatchObject({ position: 10, carNumber: '8', timeOrGap: '1 Lap', laps: 190, driverName: 'BRENDON HARTLEY, RYŌ HIRAKAWA, SÉBASTIEN BUEMI' });
    expect(doc?.rows[11]).toMatchObject({ carNumber: '007', team: 'ASTON MARTIN THOR TEAM' });
    expect(doc?.rows[16]).toMatchObject({ position: 17, timeOrGap: '129 Laps', laps: 62 });
    expect(hasUndefined(doc)).toBe(false);

    // another session of the round: its own page; the crews are read once
    const hp = await source.results(2026, monza, sessionOf(monza, 'r8-hp-hypercar'), deps);
    expect(hp?.source?.url).toBe(resultsUrl(5066, 8291));
    expect(hp?.rows).toHaveLength(10);
    expect(hp?.rows.slice(0, 2).map((r) => [r.position, r.carNumber, r.timeOrGap])).toEqual([
      [1, '50', '1:33.364'],
      [2, '19', '1:33.460'],
    ]);
    expect(calls.filter((u) => u === standingsUrl(4175))).toHaveLength(1);
  });

  it('gives null for a session the page has no results of, and for a page of another round', async () => {
    const rounds = await calendar2026();
    const monza = roundOf(rounds, 8);
    // Hyperpole - LMGT3 is listed, but its page is a 404 here
    expect(await source.results(2026, monza, sessionOf(monza, 'r8-hp-lmgt3'), fake().deps)).toBeNull();
    // a session the page does not list
    const ghost: Session = { ...sessionOf(monza, 'r8-race'), id: 'r8-race-2', name: 'Race 2' };
    expect(await source.results(2026, monza, ghost, fake().deps)).toBeNull();
    // Imola's results URL answering with Monza's page: the race id does not match
    const imola = roundOf(rounds, 1);
    const { deps, calls } = fake({ [resultsUrl(4948)]: fixture('resultats-5066.html') });
    expect(await source.results(2026, imola, sessionOf(imola, 'r1-race'), deps)).toBeNull();
    expect(calls).toEqual([resultsUrl(4948)]);
    // no results page yet
    expect(await source.results(2026, roundOf(rounds, 3), sessionOf(roundOf(rounds, 3), 'r3-race'), fake().deps)).toBeNull();
  });

  it('parses the page itself: the race, its sessions and the class', () => {
    const page = parseResults(fixture('resultats-5066.html'));
    expect(page).toMatchObject({ raceId: 5066, sessionId: 8292, seasonId: 4175, class: 'hypercar', state: 'final' });
    expect(page.sessions[0]).toEqual({ id: 8292, name: 'Race' });
    expect(page.sessions.map((s) => s.id)).toEqual([8292, 8291, 8290, 8289, 8288, 8287, 8286, 8285]);
  });

  it('polls the race for an hour and no other session', async () => {
    const monza = roundOf(await calendar2026(), 8);
    expect(resultsWindowMinutes(sessionOf(monza, 'r8-race'))).toBe(60);
    expect(resultsWindowMinutes(sessionOf(monza, 'r8-hp-hypercar'))).toBe(0);
    expect(source.resultsWindowMinutes(sessionOf(monza, 'r8-fp1'))).toBe(0);
  });
});

describe('the standings', () => {
  it('reads the Hypercar manufacturers and drivers', async () => {
    const { teams, drivers } = await source.standings(2026, fake().deps);
    expect(teams?.kind).toBe('teams');
    expect(teams?.afterRound).toBe(8);
    expect(teams?.rows).toHaveLength(8);
    expect(teams?.rows[0]).toEqual({ position: 1, name: 'TOYOTA', points: 215 });
    expect(teams?.rows[7]).toEqual({ position: 8, name: 'GENESIS', points: 14 });
    expect(drivers?.kind).toBe('drivers');
    expect(drivers?.afterRound).toBe(8);
    expect(drivers?.rows).toHaveLength(5);
    expect(drivers?.rows[0]).toEqual({ position: 1, name: 'BRENDON HARTLEY, RYŌ HIRAKAWA, SÉBASTIEN BUEMI', team: 'TOYOTA #8', points: 115 });
    expect(drivers?.rows[3]).toEqual({ position: 4, name: 'EARL BAMBER, SÉBASTIEN BOURDAIS', team: 'CADILLAC #38', points: 81 });
    // the LMGT3 trophy is not the Hypercar table
    expect(drivers?.rows.some((r) => r.name.includes('JONNY EDGAR'))).toBe(false);
  });

  it("reads another season's page through the season options, and none for a season the site does not offer", async () => {
    const { deps, calls } = fake();
    expect(await source.standings(2025, deps)).toEqual({ drivers: null, teams: null });
    expect(calls).toEqual([standingsUrl(), standingsUrl(4172)]);
    expect(await source.standings(2027, fake().deps)).toEqual({ drivers: null, teams: null });
  });

  it('reads the crews of every drivers table (the LMGT3 trophy included)', () => {
    const crews = parseCrews(fixture('classification-2026.html'));
    expect(crews.get('8')).toEqual(['BRENDON HARTLEY', 'RYŌ HIRAKAWA', 'SÉBASTIEN BUEMI']);
    expect(crews.get('33')).toEqual(['JONNY EDGAR']);
  });

  it('throws a ShapeError for a page without its tables', () => {
    const broken = fixture('classification-2026.html').replace(/<table\b[\s\S]*?<\/table>/g, '');
    expect(() => parseStandings(broken)).toThrow(ShapeError);
  });
});

describe('the AI repair step', () => {
  const brokenResults = () => fixture('resultats-5066.html').replaceAll('CompleteResultsComponent', 'ResultsTableV2');
  const brokenStandings = () => fixture('classification-2026.html').replace(/<table\b[\s\S]*?<\/table>/g, '');

  it('reads results the parser no longer can: validated rows, the source marked', async () => {
    const monza = roundOf(await calendar2026(), 8);
    const repair = vi.fn<Repair>(async () => ({
      state: 'final',
      rows: [
        { position: 1, carNumber: 38, driverName: 'EARL BAMBER', team: 'CADILLAC HERTZ TEAM JOTA', timeOrGap: '6:01:33.199', laps: 191, class: 'hypercar' },
        { position: 2, driverName: '', team: 'ALPINE ENDURANCE TEAM', timeOrGap: 5.607 },
        { position: -1, driverName: '', team: 'NEGATIVE', timeOrGap: '1' },
        { position: 3, driverName: '', team: '', timeOrGap: 'no team' },
        { position: 4, team: 'NO DRIVER FIELD', timeOrGap: '2' },
        { position: 5, driverName: '', team: 'BAD CLASS', timeOrGap: '3', class: 'gt4' },
        { position: 6, driverName: '', team: 'BAD LAPS', timeOrGap: '4', laps: 'many' },
        'not a row',
      ],
    }));
    const { deps } = fake({ [resultsUrl(5066)]: brokenResults() }, repair);
    const doc = await source.results(2026, monza, sessionOf(monza, 'r8-race'), deps);

    expect(repair).toHaveBeenCalledTimes(1);
    const task = repair.mock.calls[0][0];
    expect(task).toMatchObject({ series: 'wec', what: 'results', url: resultsUrl(5066) });
    expect(task.text).toContain('CADILLAC HERTZ TEAM JOTA');
    expect(task.text).not.toContain('<td');
    expect(task.text.length).toBeLessThanOrEqual(REPAIR_MAX);

    expect(doc?.state).toBe('final');
    expect(doc?.source).toEqual({ name: `${NAME} (read with AI repair)`, url: resultsUrl(5066) });
    expect(doc?.rows).toEqual([
      { position: 1, carNumber: '38', driverName: 'EARL BAMBER', team: 'CADILLAC HERTZ TEAM JOTA', timeOrGap: '6:01:33.199', laps: 191, class: 'hypercar' },
      { position: 2, driverName: '', team: 'ALPINE ENDURANCE TEAM', timeOrGap: '5.607' },
    ]);
  });

  it('throws the ShapeError when the answer holds no valid row, the step fails, or there is no repair step', async () => {
    const monza = roundOf(await calendar2026(), 8);
    const race = sessionOf(monza, 'r8-race');
    const files = { [resultsUrl(5066)]: brokenResults() };
    const invalid = vi.fn<Repair>(async () => ({ rows: [{ position: 'first', team: 42 }] }));
    await expect(source.results(2026, monza, race, fake(files, invalid).deps)).rejects.toBeInstanceOf(ShapeError);
    expect(invalid).toHaveBeenCalledTimes(1);
    await expect(source.results(2026, monza, race, fake(files, async () => null).deps)).rejects.toBeInstanceOf(ShapeError);
    const failing = vi.fn<Repair>(async () => {
      throw new Error('model unavailable');
    });
    await expect(source.results(2026, monza, race, fake(files, failing).deps)).rejects.toBeInstanceOf(ShapeError);
    await expect(source.results(2026, monza, race, fake(files).deps)).rejects.toBeInstanceOf(ShapeError);
  });

  it('does not repair the default page for a session it does not show (it shows the race)', async () => {
    const monza = roundOf(await calendar2026(), 8);
    const repair = vi.fn<Repair>(async () => []);
    const { deps } = fake({ [resultsUrl(5066)]: brokenResults() }, repair);
    await expect(source.results(2026, monza, sessionOf(monza, 'r8-hp-hypercar'), deps)).rejects.toBeInstanceOf(ShapeError);
    expect(repair).not.toHaveBeenCalled();
  });

  it('reads standings the parser no longer can', async () => {
    const repair = vi.fn<Repair>(async () => ({
      season: 2026,
      afterRound: 8,
      teams: [
        { position: 1, name: 'TOYOTA', points: 215 },
        { position: 0, name: 'ZERO', points: 1 },
        { position: 2, name: '', points: 1 },
        { position: 3, name: 'NEGATIVE', points: -5 },
      ],
      drivers: 'none',
    }));
    const { deps } = fake({ [standingsUrl()]: brokenStandings() }, repair);
    expect(await source.standings(2026, deps)).toEqual({
      teams: { kind: 'teams', afterRound: 8, rows: [{ position: 1, name: 'TOYOTA', points: 215 }] },
      drivers: null,
    });
    expect(repair).toHaveBeenCalledWith(expect.objectContaining({ series: 'wec', what: 'standings', url: standingsUrl() }));

    const invalid = vi.fn<Repair>(async () => ({ teams: [{ position: 1, name: 'TOYOTA' }] }));
    await expect(source.standings(2026, fake({ [standingsUrl()]: brokenStandings() }, invalid).deps)).rejects.toBeInstanceOf(ShapeError);
    await expect(source.standings(2026, fake({ [standingsUrl()]: brokenStandings() }).deps)).rejects.toBeInstanceOf(ShapeError);
  });

  it('is not called when the pages parse', async () => {
    const monza = roundOf(await calendar2026(), 8);
    const repair = vi.fn<Repair>(async () => []);
    const { deps } = fake({}, repair);
    const doc = await source.results(2026, monza, sessionOf(monza, 'r8-race'), deps);
    expect(doc?.source?.name).toBe(NAME);
    const standings = await source.standings(2026, deps);
    expect(standings.teams?.rows).toHaveLength(8);
    expect(repair).not.toHaveBeenCalled();
  });

  it('cuts the text it gives to REPAIR_MAX characters', () => {
    const big = `<main><script>var x = "<td>";</script>${'<p>Lorem ipsum dolor sit amet</p>'.repeat(5000)}</main>`;
    const text = repairText(big);
    expect(text.length).toBe(REPAIR_MAX);
    expect(text).not.toContain('var x');
  });
});
