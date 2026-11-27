import { describe, expect, it } from 'vitest';
import { AI_SERIES, AiBusyError, GEMINI_KEY_VARIABLE, MODEL, geminiRepair, isBusy, repairPrompt } from '../service/sync/ai.mjs';

// The WEC's AI repair step over a fake fetch: no network, and a made-up key that only these tests know.

const KEY = 'fake-key-for-tests';
const env = { [GEMINI_KEY_VARIABLE]: KEY };
const task = { series: 'wec' as const, what: 'results' as const, url: 'https://www.fiawec.com/en/results', text: 'Pos 1 #7 Toyota' };

function fakeGemini(answer: () => Response) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetch = (async (url: string | URL | Request, init: RequestInit = {}) => {
    calls.push({ url: String(url), init });
    return answer();
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const geminiAnswer = (text: string) => Response.json({ candidates: [{ content: { parts: [{ text }] } }] });

describe('geminiRepair', () => {
  it('is off (null) while the user has set no key', () => {
    expect(geminiRepair({ env: {} })).toBeNull();
    expect(geminiRepair({ env: { [GEMINI_KEY_VARIABLE]: '  ' } })).toBeNull();
  });

  it('reads the WEC only (decision D3): every other series is refused before any request', async () => {
    expect(AI_SERIES).toEqual(['wec']);
    const { fetch, calls } = fakeGemini(() => geminiAnswer('[]'));
    const repair = geminiRepair({ env, fetch })!;
    for (const series of ['f1', 'f2', 'f3', 'f1academy', 'fe'] as const) {
      await expect(repair({ ...task, series })).rejects.toThrow(/no AI on/);
    }
    expect(calls).toEqual([]);
  });

  it('asks Gemini for JSON with the key in a header, never in the URL, and gives the parsed answer', async () => {
    const rows = [{ position: 1, carNumber: '7', class: 'hypercar', team: 'Toyota Gazoo Racing', driverName: 'A / B / C', timeOrGap: '6:00:00', laps: 200 }];
    const { fetch, calls } = fakeGemini(() => geminiAnswer('```json\n' + JSON.stringify(rows) + '\n```'));
    const repair = geminiRepair({ env, fetch })!;
    expect(await repair(task)).toEqual(rows);
    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`);
    expect(calls[0].url).not.toContain(KEY);
    expect((calls[0].init.headers as Record<string, string>)['x-goog-api-key']).toBe(KEY);
    const body = JSON.parse(String(calls[0].init.body));
    expect(body.generationConfig).toEqual({ responseMimeType: 'application/json', temperature: 0 });
    expect(body.contents[0].parts[0].text).toContain('Pos 1 #7 Toyota');
    expect(String(calls[0].init.body)).not.toContain(KEY);
  });

  it('reads the key again at each call, so a key removed later turns the step off', async () => {
    const live: Record<string, string | undefined> = { ...env };
    const { fetch } = fakeGemini(() => geminiAnswer('[]'));
    const repair = geminiRepair({ env: live, fetch })!;
    delete live[GEMINI_KEY_VARIABLE];
    await expect(repair(task)).rejects.toThrow(`${GEMINI_KEY_VARIABLE} is not set`);
  });

  it('says busy on 429, 503 and RESOURCE_EXHAUSTED, and names other statuses without the answer', async () => {
    const busy = geminiRepair({ env, fetch: fakeGemini(() => new Response('{"error":{"code":429}}', { status: 429 })).fetch })!;
    await expect(busy(task)).rejects.toBeInstanceOf(AiBusyError);
    const exhausted = geminiRepair({ env, fetch: fakeGemini(() => new Response('{"error":{"status":"RESOURCE_EXHAUSTED"}}', { status: 400 })).fetch })!;
    await expect(exhausted(task)).rejects.toBeInstanceOf(AiBusyError);
    const refused = geminiRepair({ env, fetch: fakeGemini(() => new Response('{"error":{"message":"API key not valid"}}', { status: 400 })).fetch })!;
    await expect(refused(task)).rejects.toThrow(/^Gemini: HTTP 400$/);
  });

  it('fails plainly when the answer is not JSON', async () => {
    const repair = geminiRepair({ env, fetch: fakeGemini(() => geminiAnswer('Sorry, I cannot read that page.')).fetch })!;
    await expect(repair(task)).rejects.toThrow('Gemini: the answer was not JSON');
  });
});

describe('isBusy and the prompt', () => {
  it('knows the busy answers', () => {
    expect(isBusy(503, '')).toBe(true);
    expect(isBusy(400, '{"error":{"status":"UNAVAILABLE"}}')).toBe(true);
    expect(isBusy(400, 'not json')).toBe(false);
    expect(isBusy(403, '{"error":{"status":"PERMISSION_DENIED"}}')).toBe(false);
  });

  it('asks for the exact shape and nothing else', () => {
    const p = repairPrompt('standings', 'the page');
    expect(p).toContain('championship standings');
    expect(p).toContain('JSON array only');
    expect(p.endsWith('the page')).toBe(true);
  });
});
