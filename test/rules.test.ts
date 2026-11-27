import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  SERIES_IDS,
  SERIES_NAMES,
  isClientWritable,
  isSeriesId,
  notificationSettingsPath,
  pushSubscriptionPath,
  resultPath,
  seasonPath,
  seriesDocPath,
  standingsPath,
  syncMetaPath,
} from '../src/lib/raceData';
import * as daily from '../service/rawe-ceek-daily.mjs';

// The rules are text for the Firebase console, so the tests read the file: the shape that keeps the data private and
// the uid out of the repository. (A rules emulator needs Java and a download: not part of the gates.)

const rules = readFileSync(new URL('../firestore.rules', import.meta.url), 'utf8');
const code = rules.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');

describe('firestore.rules', () => {
  it('pins the owner by a uid placeholder, never a real uid', () => {
    const pins = [...code.matchAll(/request\.auth\.uid\s*==\s*'([^']*)'/g)].map((m) => m[1]);
    expect(pins).toEqual(['OWNER_UID_PLACEHOLDER']);
  });

  it('keeps the read rule of race data in one function', () => {
    expect(code.match(/function canRead\(\)/g)).toHaveLength(1);
    expect(code).toMatch(/function canRead\(\)\s*\{\s*return isOwner\(\);\s*\}/);
    expect(code.match(/allow read: if canRead\(\)/g)).toHaveLength(2); // series/** and meta/**
  });

  it('lets no client write series or meta', () => {
    expect(code).toMatch(/match \/series\/\{seriesId\}\/\{document=\*\*\}\s*\{ allow read: if canRead\(\); allow write: if false; \}/);
    expect(code).toMatch(/match \/meta\/\{document=\*\*\}\s*\{ allow read: if canRead\(\); allow write: if false; \}/);
  });

  it('lets only the owner read and write the settings and the push subscriptions', () => {
    expect(code).toMatch(/match \/settings\/\{document=\*\*\}\s*\{ allow read, write: if isOwner\(\); \}/);
    expect(code).toMatch(/match \/pushSubscriptions\/\{document=\*\*\}\s*\{ allow read, write: if isOwner\(\); \}/);
  });

  it('denies everything else, dueNotifications included', () => {
    expect(code).toMatch(/match \/\{document=\*\*\}\s*\{ allow read, write: if false; \}/);
    expect(code).not.toMatch(/dueNotifications/);
    expect(code).not.toMatch(/allow [a-z, ]+: if true/);
  });

  it('matches only the collections of the data model', () => {
    const matched = [...code.matchAll(/match \/([a-zA-Z]+)\//g)].map((m) => m[1]).filter((m) => m !== 'databases');
    expect(matched.sort()).toEqual(['meta', 'pushSubscriptions', 'series', 'settings'].sort());
  });
});

describe('the data model paths', () => {
  it('has the six series, each named', () => {
    expect([...SERIES_IDS]).toEqual(['f1', 'f2', 'f3', 'f1academy', 'wec', 'fe']);
    for (const id of SERIES_IDS) expect(SERIES_NAMES[id].trim()).not.toBe('');
    expect(isSeriesId('wec')).toBe(true);
    expect(isSeriesId('indycar')).toBe(false);
  });

  it('builds the paths the rules match', () => {
    expect(seriesDocPath('f1')).toBe('series/f1');
    expect(seasonPath('f1academy', 2027)).toBe('series/f1academy/seasons/2027');
    expect(resultPath('fe', 2027, 'r3-race')).toBe('series/fe/seasons/2027/results/r3-race');
    expect(standingsPath('wec', 2026, 'teams')).toBe('series/wec/seasons/2026/standings/teams');
    expect(syncMetaPath()).toBe('meta/sync');
  });

  it('lets a client write only its settings and its own subscription', () => {
    expect(isClientWritable(notificationSettingsPath())).toBe(true);
    expect(isClientWritable(pushSubscriptionPath('phone-1'))).toBe(true);
    expect(isClientWritable(seasonPath('f1', 2026))).toBe(false);
    expect(isClientWritable(syncMetaPath())).toBe(false);
    expect(isClientWritable('dueNotifications/day__f1__x')).toBe(false);
    expect(isClientWritable('pushSubscriptions/a/b')).toBe(false);
  });
});

describe('the writer key', () => {
  it('reads only the path of the key file, from an environment variable', () => {
    expect(daily.FIREBASE_KEY_FILE_VARIABLE).toBe('RAWE_CEEK_FIREBASE_KEY_FILE');
    expect(daily.firebaseKeyFile({})).toBeNull();
    expect(daily.firebaseKeyFile({ RAWE_CEEK_FIREBASE_KEY_FILE: '  ' })).toBeNull();
    expect(daily.firebaseKeyFile({ RAWE_CEEK_FIREBASE_KEY_FILE: ' C:\\keys\\writer.json ' })).toBe('C:\\keys\\writer.json');
  });
});
