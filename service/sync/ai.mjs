// The one AI step of the data sync (RW.RESEARCH 1.8 and 9.4): a repair read of a WEC results or standings page when
// the page's layout shifted and the plain parser no longer knows it. Decision D3: never on Formula 1, F2, F3, F1
// Academy or Formula E content, so this module refuses every series but the WEC. It follows SmakMal's AI route
// (lib/server-api.ts): Gemini's gemini-2.5-flash over REST with the key in the x-goog-api-key header, and the same
// busy check (HTTP 429 or 503, RESOURCE_EXHAUSTED, UNAVAILABLE). The key is read from the environment at each call,
// never stored, logged or sent anywhere but Google's endpoint.

/** @typedef {import('./source.mjs').Repair} Repair */
/** @typedef {import('../../src/lib/raceData.ts').SeriesId} SeriesId */

/** The environment variable the user sets on the PC for the repair step (optional: without it the step is off). */
export const GEMINI_KEY_VARIABLE = 'RAWE_CEEK_GEMINI_API_KEY';
export const MODEL = 'gemini-2.5-flash';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

/** The series the AI step may read: the WEC only. */
export const AI_SERIES = /** @type {readonly SeriesId[]} */ (['wec']);

/** The model is busy or out of quota: the run goes on without the repair and tries again next time. */
export class AiBusyError extends Error {
  constructor() {
    super('the AI model is busy or out of quota (Gemini 429 or 503)');
    this.name = 'AiBusyError';
  }
}

/** Whether a Gemini error answer means busy or out of quota (SmakMal's isOverloaded). @param {number} status @param {string} text */
export function isBusy(status, text) {
  if (status === 429 || status === 503) return true;
  try {
    const e = JSON.parse(text)?.error;
    return Boolean(e && (e.code === 429 || e.code === 503 || e.status === 'RESOURCE_EXHAUSTED' || e.status === 'UNAVAILABLE'));
  } catch {
    return false;
  }
}

/** The prompt: what to read and the exact JSON shape, nothing else. @param {'results' | 'standings'} what @param {string} text */
export function repairPrompt(what, text) {
  const shape =
    what === 'results'
      ? '[{"position": number or null, "carNumber": string, "class": "hypercar" | "lmgt3" | "lmp2", "team": string, "driverName": string (the crew, names joined with " / "), "timeOrGap": string, "laps": number}]'
      : '[{"position": number, "name": string, "team": string or omitted, "points": number}]';
  return [
    `Below is the text of a page of the FIA World Endurance Championship's website. Read the ${what === 'results' ? 'race classification' : 'championship standings'} from it.`,
    `Answer with a JSON array only, in this shape: ${shape}.`,
    'Copy names, numbers and times exactly as the page gives them. Leave out anything the page does not state. Do not add commentary.',
    '',
    text,
  ].join('\n');
}

/**
 * The repair step, or null when the user set no key (the step is optional). The key is read again at each call.
 * @param {{ env?: NodeJS.ProcessEnv, fetch?: typeof fetch, timeoutMs?: number, signal?: AbortSignal }} [o]
 * @returns {Repair | null}
 */
export function geminiRepair(o = {}) {
  const env = o.env ?? process.env;
  const doFetch = o.fetch ?? fetch;
  if (!env[GEMINI_KEY_VARIABLE]?.trim()) return null;
  return async ({ series, what, text }) => {
    if (!AI_SERIES.includes(series)) throw new Error(`no AI on ${series} content (decision D3): the WEC only`);
    const key = env[GEMINI_KEY_VARIABLE]?.trim();
    if (!key) throw new Error(`${GEMINI_KEY_VARIABLE} is not set`);
    const body = {
      contents: [{ role: 'user', parts: [{ text: repairPrompt(what, text.slice(0, 30_000)) }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0 },
    };
    const signals = [AbortSignal.timeout(o.timeoutMs ?? 60_000), ...(o.signal ? [o.signal] : [])];
    const r = await doFetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      signal: AbortSignal.any(signals),
    });
    const answer = await r.text();
    if (!r.ok) {
      if (isBusy(r.status, answer)) throw new AiBusyError();
      throw new Error(`Gemini: HTTP ${r.status}`);
    }
    const out = JSON.parse(answer)?.candidates?.[0]?.content?.parts?.map((/** @type {{ text?: string }} */ p) => p.text ?? '').join('') ?? '';
    try {
      return JSON.parse(out.replace(/^```(?:json)?\s*|\s*```$/g, ''));
    } catch {
      throw new Error('Gemini: the answer was not JSON');
    }
  };
}
