// The polite getter every source fetches through (RW.RESEARCH 1.2, rules 4 and 5): a descriptive User-Agent, one
// request at a time with a gap between two to the same host, a time limit, and the caller's abort signal. It never
// throws on an HTTP status: a 404 is how a source says "not published yet", so the source decides.

/** The User-Agent the sources see: the app and where to reach its owner (the repository, no e-mail address). */
export const USER_AGENT = 'RaweCeek/0.1 (private racing calendar; https://github.com/zgyorkei/rawe_ceek)';

/** @typedef {{ status: number, text: string, url: string }} Fetched */
/**
 * A source's GET. `accept` defaults to anything; the answer's body is text (a source parses JSON itself).
 * @typedef {(url: string, o?: { accept?: string }) => Promise<Fetched>} Get
 */

/**
 * The getter the service uses. `gapMs` is the least time between two requests to the same host (the sources state no
 * limit but Jolpica's 4 a second and OpenF1's 3 a second; a second apart keeps well inside every one).
 * @param {{ fetch?: typeof fetch, signal?: AbortSignal, timeoutMs?: number, gapMs?: number, now?: () => number, sleep?: (ms: number) => Promise<void> }} [o]
 * @returns {Get}
 */
export function politeGet(o = {}) {
  const doFetch = o.fetch ?? fetch;
  const timeoutMs = o.timeoutMs ?? 30_000;
  const gapMs = o.gapMs ?? 1_000;
  const now = o.now ?? Date.now;
  const sleep = o.sleep ?? ((ms) => new Promise((done) => setTimeout(done, ms)));
  /** @type {Map<string, number>} */
  const lastAt = new Map();
  /** @type {Promise<unknown>} */
  let queue = Promise.resolve();
  return (url, { accept = '*/*' } = {}) => {
    const run = async () => {
      o.signal?.throwIfAborted();
      const host = new URL(url).host;
      const wait = (lastAt.get(host) ?? -Infinity) + gapMs - now();
      if (wait > 0) await sleep(wait);
      lastAt.set(host, now());
      const signals = [AbortSignal.timeout(timeoutMs), ...(o.signal ? [o.signal] : [])];
      const r = await doFetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: accept }, signal: AbortSignal.any(signals) });
      return { status: r.status, text: await r.text(), url };
    };
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  };
}

/** The error a source throws when an answer is not what its parser expects (a redesign: the main risk, rule 5). */
export class ShapeError extends Error {
  /** @param {string} source @param {string} message */
  constructor(source, message) {
    super(`${source}: ${message}`);
    this.name = 'ShapeError';
  }
}

/**
 * The text of a 200 answer, or null for a 404 (not published); anything else throws.
 * @param {Fetched} r @param {string} source
 */
export function okText(r, source) {
  if (r.status === 404) return null;
  if (r.status !== 200) throw new Error(`${source}: HTTP ${r.status} from ${r.url}`);
  return r.text;
}
