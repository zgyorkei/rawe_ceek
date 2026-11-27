import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  FIREBASE_KEY_FILE_VARIABLE,
  assertServicePath,
  decodeFields,
  encodeFields,
  fakeFirestoreFetch,
  firestoreWriter,
  memoryStore,
  writerFromEnv,
} from '../service/sync/firestore.mjs';

// The real REST writer over a fake fetch that answers as Firestore does (no network, no key): its URLs, its encoding
// of nested documents, its path guard, and a missing document as null.

const TOKEN = 'test-token';
const writer = (o: { databaseId?: string } = {}) => {
  const fake = fakeFirestoreFetch({ token: TOKEN });
  const store = firestoreWriter({ projectId: 'rawe-ceek-test', databaseId: o.databaseId, token: async () => TOKEN, fetch: fake.fetch });
  return { fake, store };
};

const season = {
  series: 'f1',
  season: 2026,
  contentHash: 'abc123',
  rounds: [
    {
      round: 22,
      name: 'Qatar Grand Prix',
      lat: 25.49,
      long: null,
      sharedWith: [{ series: 'f2', round: 14 }],
      source: { name: 'Jolpica-F1', url: 'https://api.jolpi.ca/', fetchedAt: '2026-11-27T04:00:00Z' },
      sessions: [{ id: 'r22-race', endUtc: null, cancelled: false, laps: 57 }],
      artKeys: {},
      empty: [],
    },
  ],
};

describe('the Firestore writer', () => {
  it('writes a nested document and reads it back the same', async () => {
    const { store, fake } = writer();
    await store.set('series/f1/seasons/2026', season);
    expect(await store.get('series/f1/seasons/2026')).toEqual(season);
    const patch = fake.requests.find((r) => r.method === 'PATCH')!;
    expect(patch.url).toBe('https://firestore.googleapis.com/v1/projects/rawe-ceek-test/databases/(default)/documents/series/f1/seasons/2026');
  });

  it('stores numbers as Firestore does: integers as integerValue, others as doubleValue', async () => {
    const { store, fake } = writer();
    await store.set('meta/sync', { a: 3, b: 2.5, c: true, d: null, e: 'x', f: undefined });
    expect(fake.documents.get('meta/sync')?.fields).toEqual({
      a: { integerValue: '3' },
      b: { doubleValue: 2.5 },
      c: { booleanValue: true },
      d: { nullValue: null },
      e: { stringValue: 'x' },
    });
  });

  it('gives null for a document that is not there (404)', async () => {
    const { store } = writer();
    expect(await store.get('series/f9')).toBeNull();
  });

  it('names the database it is given', async () => {
    const { store, fake } = writer({ databaseId: 'rawe-ceek' });
    await store.get('meta/sync');
    expect(fake.requests[0].url).toContain('/databases/rawe-ceek/documents/meta/sync');
  });

  it('sends the token as a bearer header and fails with the HTTP status when refused', async () => {
    const fake = fakeFirestoreFetch({ token: TOKEN });
    const store = firestoreWriter({ projectId: 'rawe-ceek-test', token: async () => 'another-token', fetch: fake.fetch });
    await expect(store.get('meta/sync')).rejects.toThrow(/Firestore read of meta\/sync: HTTP 401/);
    await expect(store.set('meta/sync', { a: 1 })).rejects.toThrow(/Firestore write of meta\/sync: HTTP 401/);
  });

  it('refuses a project or database id that is not one', () => {
    expect(() => firestoreWriter({ projectId: '../x', token: async () => TOKEN })).toThrow(/project id/);
    expect(() => firestoreWriter({ projectId: 'rawe-ceek-test', databaseId: 'a/b', token: async () => TOKEN })).toThrow(/database id/);
  });
});

describe('the path guard', () => {
  it('lets the service write only documents under series/, meta/ and dueNotifications/', () => {
    for (const ok of ['series/f1', 'series/f1/seasons/2026', 'series/wec/seasons/2026/results/r8-race', 'meta/sync', 'dueNotifications/abc']) {
      expect(() => assertServicePath(ok)).not.toThrow();
    }
    for (const bad of [
      'settings/notifications',
      'pushSubscriptions/device-1',
      'series',
      'series/f1/seasons',
      'series/../settings/x',
      'series//f1',
      'meta/sync?x=1',
      'series/f1 /seasons/2026',
      'users/me',
    ]) {
      expect(() => assertServicePath(bad), bad).toThrow(/does not write/);
    }
  });

  it('guards the writer and the memory store the same way, before any request', async () => {
    const { store, fake } = writer();
    await expect(store.set('settings/notifications', { a: 1 })).rejects.toThrow(/does not write/);
    await expect(store.get('pushSubscriptions/x')).rejects.toThrow(/does not write/);
    expect(fake.requests).toEqual([]);
    const memory = memoryStore();
    await expect(memory.set('settings/notifications', { a: 1 })).rejects.toThrow(/does not write/);
  });
});

describe('the encoding', () => {
  it('round-trips through the REST form, leaving undefined fields out', () => {
    expect(decodeFields(encodeFields(season))).toEqual(season);
    expect(decodeFields(encodeFields({ a: undefined, b: [1, 'x', null] }))).toEqual({ b: [1, 'x', null] });
  });

  it('refuses what Firestore cannot hold', () => {
    expect(() => encodeFields({ a: Number.NaN })).toThrow(/finite/);
    expect(() => encodeFields({ a: () => 1 })).toThrow(/cannot store/);
  });
});

describe('writerFromEnv', () => {
  it('is null when the key file variable is not set', () => {
    expect(writerFromEnv({})).toBeNull();
    expect(writerFromEnv({ [FIREBASE_KEY_FILE_VARIABLE]: '  ' })).toBeNull();
  });

  it('refuses a key file given by a relative path or kept inside a repository, before reading it', () => {
    expect(() => writerFromEnv({ [FIREBASE_KEY_FILE_VARIABLE]: 'key.json' })).toThrow(/absolute path/);
    const inRepo = fileURLToPath(new URL('../not-a-key.json', import.meta.url));
    expect(() => writerFromEnv({ [FIREBASE_KEY_FILE_VARIABLE]: inRepo })).toThrow(/inside the repository/);
  });
});
