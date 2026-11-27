// The desktop service's Firestore writer (RW.RESEARCH 6.5, option A): Firestore's REST API with an access token of
// the service account whose key file the user names in RAWE_CEEK_FIREBASE_KEY_FILE (decision D9). The token is signed
// with node:crypto by the kit (serviceAccountToken) and kept in memory only: no SDK, no session in Electron
// safeStorage, no OS key store. The writer may touch series/**, meta/** and dueNotifications/** only, the documents
// the rules keep from every client; the page's own settings and subscriptions are never written here.

import { DATABASE_ID, FIRESTORE_URL, PROJECT_ID, assertKeyFileOutsideRepository, readServiceAccountKey, serviceAccountToken } from 'desktop-kit/service';

/** The environment variable with the key file's path (set once by the user on the PC; never the key itself). */
export const FIREBASE_KEY_FILE_VARIABLE = 'RAWE_CEEK_FIREBASE_KEY_FILE';
/** An optional environment variable naming a Firestore database other than "(default)". */
export const FIRESTORE_DATABASE_VARIABLE = 'RAWE_CEEK_FIRESTORE_DATABASE';

/** @typedef {{ [field: string]: unknown }} Data */
/**
 * What the sync reads and writes through: a document's data or null, and a whole-document write.
 * @typedef {{ get(path: string): Promise<Data | null>, set(path: string, data: Data): Promise<void> }} DocStore
 */

const WRITABLE = /^(series|meta|dueNotifications)\//;

/**
 * Throws unless `path` is a document the service may write: under series/, meta/ or dueNotifications/, an even
 * number of plain segments (a document, never a collection), no empty or dot segment.
 * @param {string} path
 */
export function assertServicePath(path) {
  const segments = path.split('/');
  const plain = segments.every((s) => s !== '' && s !== '.' && s !== '..' && !/[\s?#%\\]/.test(s));
  if (!WRITABLE.test(path) || !plain || segments.length % 2 !== 0) {
    throw new Error(`the service does not write ${JSON.stringify(path)}: only documents under series/, meta/ and dueNotifications/`);
  }
}

/**
 * A value in Firestore's REST form, nested maps and arrays included (the kit's encodeValue takes scalars only).
 * undefined fields are left out, as the SDK does with ignoreUndefinedProperties.
 * @param {unknown} v @returns {Record<string, unknown>}
 */
export function encodeValue(v) {
  if (v === null) return { nullValue: null };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') {
    if (!Number.isFinite(v)) throw new Error(`not a finite number: ${v}`);
    return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  }
  if (typeof v === 'string') return { stringValue: v };
  if (Array.isArray(v)) return { arrayValue: v.length ? { values: v.map(encodeValue) } : {} };
  if (typeof v === 'object') return { mapValue: { fields: encodeFields(/** @type {Data} */ (v)) } };
  throw new Error(`cannot store a ${typeof v}`);
}

/** @param {Data} data @returns {Record<string, unknown>} */
export function encodeFields(data) {
  /** @type {Record<string, unknown>} */
  const fields = {};
  for (const [k, v] of Object.entries(data)) if (v !== undefined) fields[k] = encodeValue(v);
  return fields;
}

/** A value from Firestore's REST form. @param {unknown} f @returns {unknown} */
export function decodeValue(f) {
  if (!f || typeof f !== 'object') return null;
  const o = /** @type {Record<string, any>} */ (f);
  if ('nullValue' in o) return null;
  if ('booleanValue' in o) return Boolean(o.booleanValue);
  if ('integerValue' in o) return Number(o.integerValue);
  if ('doubleValue' in o) return Number(o.doubleValue);
  if ('stringValue' in o) return String(o.stringValue);
  if ('timestampValue' in o) return String(o.timestampValue);
  if ('arrayValue' in o) return (o.arrayValue?.values ?? []).map(decodeValue);
  if ('mapValue' in o) return decodeFields(o.mapValue?.fields);
  return null;
}

/** @param {unknown} fields @returns {Data} */
export function decodeFields(fields) {
  /** @type {Data} */
  const data = {};
  if (fields && typeof fields === 'object') for (const [k, v] of Object.entries(fields)) data[k] = decodeValue(v);
  return data;
}

/**
 * The writer over Firestore's REST API.
 * @param {{ projectId: string, databaseId?: string, token: () => Promise<string>, fetch?: typeof fetch, timeoutMs?: number, signal?: AbortSignal }} o
 * @returns {DocStore}
 */
export function firestoreWriter(o) {
  const databaseId = o.databaseId ?? '(default)';
  if (!PROJECT_ID.test(o.projectId)) throw new Error('not a Google Cloud project id');
  if (!DATABASE_ID.test(databaseId)) throw new Error('not a Firestore database id');
  const doFetch = o.fetch ?? fetch;
  const base = `${FIRESTORE_URL}/projects/${o.projectId}/databases/${encodeURIComponent(databaseId)}/documents`;
  const signal = () => AbortSignal.any([AbortSignal.timeout(o.timeoutMs ?? 30_000), ...(o.signal ? [o.signal] : [])]);
  /** @param {string} path @param {RequestInit} init */
  const call = async (path, init) => {
    const headers = { Authorization: `Bearer ${await o.token()}`, 'Content-Type': 'application/json' };
    return doFetch(`${base}/${path}`, { ...init, headers, signal: signal() });
  };
  /** @param {Response} r @param {string} what */
  const fail = async (r, what) => {
    // Firestore's error text names the document and the reason, never the token
    const text = (await r.text()).slice(0, 300);
    return new Error(`Firestore ${what}: HTTP ${r.status} ${text}`);
  };
  return {
    async get(path) {
      assertServicePath(path);
      const r = await call(path, { method: 'GET' });
      if (r.status === 404) return null;
      if (!r.ok) throw await fail(r, `read of ${path}`);
      const body = /** @type {{ fields?: unknown }} */ (await r.json());
      return decodeFields(body.fields);
    },
    async set(path, data) {
      assertServicePath(path);
      // a PATCH without an update mask replaces the whole document, and makes it when there is none
      const r = await call(path, { method: 'PATCH', body: JSON.stringify({ fields: encodeFields(data) }) });
      if (!r.ok) throw await fail(r, `write of ${path}`);
    },
  };
}

/**
 * The writer the service uses, from the environment: the key file's path in RAWE_CEEK_FIREBASE_KEY_FILE (an absolute
 * path outside every repository, the kit checks), the project id from the key file, the database from
 * RAWE_CEEK_FIRESTORE_DATABASE or "(default)". Null when the variable is not set. The key's content never leaves the
 * kit's signer: it is not logged, returned or kept here.
 * @param {NodeJS.ProcessEnv} [env] @param {{ fetch?: typeof fetch, signal?: AbortSignal }} [o]
 * @returns {DocStore | null}
 */
export function writerFromEnv(env = process.env, o = {}) {
  const keyFile = env[FIREBASE_KEY_FILE_VARIABLE]?.trim();
  if (!keyFile) return null;
  assertKeyFileOutsideRepository(keyFile);
  const projectId = readServiceAccountKey(keyFile).project_id;
  if (!projectId) throw new Error(`the key file in ${FIREBASE_KEY_FILE_VARIABLE} names no project_id`);
  const databaseId = env[FIRESTORE_DATABASE_VARIABLE]?.trim() || '(default)';
  return firestoreWriter({ projectId, databaseId, token: serviceAccountToken(keyFile, { fetch: o.fetch }), fetch: o.fetch, signal: o.signal });
}

/**
 * A store in memory, for the tests (the same path guard as the writer). `docs` holds plain copies.
 * @returns {DocStore & { docs: Map<string, Data>, writes: string[] }}
 */
export function memoryStore() {
  /** @type {Map<string, Data>} */
  const docs = new Map();
  /** @type {string[]} */
  const writes = [];
  return {
    docs,
    writes,
    async get(path) {
      assertServicePath(path);
      const d = docs.get(path);
      return d ? structuredClone(d) : null;
    },
    async set(path, data) {
      assertServicePath(path);
      writes.push(path);
      docs.set(path, /** @type {Data} */ (decodeFields(encodeFields(data))));
    },
  };
}

/**
 * A fetch that answers as Firestore's REST API does for GET and PATCH of documents, over a Map of REST-encoded
 * documents: lets the tests run the real writer, its URLs and its encoding, with no network.
 * @param {{ token?: string }} [o]
 * @returns {{ fetch: typeof fetch, documents: Map<string, { fields: Record<string, unknown> }>, requests: { method: string, url: string }[] }}
 */
export function fakeFirestoreFetch(o = {}) {
  /** @type {Map<string, { fields: Record<string, unknown> }>} */
  const documents = new Map();
  /** @type {{ method: string, url: string }[]} */
  const requests = [];
  /** @type {typeof fetch} */
  const fake = async (input, init = {}) => {
    const url = String(input);
    const method = init.method ?? 'GET';
    requests.push({ method, url });
    const headers = /** @type {Record<string, string>} */ (init.headers ?? {});
    if (o.token && headers.Authorization !== `Bearer ${o.token}`) return new Response('{"error":{"status":"UNAUTHENTICATED"}}', { status: 401 });
    const m = /\/documents\/(.+)$/.exec(new URL(url).pathname);
    if (!m) return new Response('{}', { status: 400 });
    const path = decodeURIComponent(m[1]);
    if (method === 'GET') {
      const d = documents.get(path);
      return d ? Response.json({ name: path, ...d }) : new Response('{"error":{"status":"NOT_FOUND"}}', { status: 404 });
    }
    if (method === 'PATCH') {
      const body = JSON.parse(String(init.body));
      documents.set(path, { fields: body.fields ?? {} });
      return Response.json({ name: path, fields: body.fields ?? {} });
    }
    return new Response('{}', { status: 405 });
  };
  return { fetch: fake, documents, requests };
}
