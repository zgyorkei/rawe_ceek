import express from 'express';
import type { Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { definitionOf } from 'desktop-kit/service';
import { checkPwaConfig } from 'pwa-kit/manifest';
import { checkNav } from 'pwa-kit/nav';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { APP } from '../app.config';
import { registerApiRoutes, serverKey } from '../lib/api';
import pwaConfig from '../pwa.config';
import * as daily from '../service/rawe-ceek-daily.mjs';
import * as local from '../service/rawe-ceek-local.mjs';
import { DESTINATIONS } from '../src/lib/nav';

describe('the app as stated', () => {
  it('has a name, a title and a port of its own', () => {
    expect(APP.name).toMatch(/^[a-z0-9][a-z0-9-]{0,47}$/);
    expect(APP.title.trim()).not.toBe('');
    expect(Number.isInteger(APP.port) && APP.port > 1024 && APP.port < 49152).toBe(true);
  });

  it('has a PWA config with no error', () => {
    expect(checkPwaConfig(pwaConfig).filter((p) => p.level === 'error')).toEqual([]);
  });

  it('has a navigation with no problem, its quick actions included', () => {
    expect(checkNav(DESTINATIONS, { quickActions: pwaConfig.quickActions })).toEqual([]);
  });
});

describe('the local service modules', () => {
  it('defines the daily job as a leased service of this app', () => {
    const d = definitionOf(daily);
    expect(d).toMatchObject({ name: `${APP.name}-daily`, app: APP.name, kind: 'leased' });
  });

  it('defines the local service as a local service of this app', () => {
    const d = definitionOf(local);
    expect(d).toMatchObject({ name: `${APP.name}-local`, app: APP.name, kind: 'local' });
  });

  it('reads its key from an environment variable, at run time', () => {
    expect(local.KEY_VARIABLE).toMatch(/^[A-Z0-9_]+_LOCAL_KEY$/);
    expect(local.localKey({})).toBeNull();
    expect(local.localKey({ [local.KEY_VARIABLE]: '  ' })).toBeNull();
    expect(local.localKey({ [local.KEY_VARIABLE]: ' a-key ' })).toBe('a-key');
  });
});

describe('the API routes', () => {
  const env: NodeJS.ProcessEnv = {};
  let server: Server;
  let base: string;

  beforeAll(async () => {
    const app = express();
    registerApiRoutes(app, env);
    server = await new Promise<Server>((done) => {
      const s = app.listen(0, '127.0.0.1', () => done(s));
    });
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((done) => server.close(() => done()));
  });

  const post = (path: string, body: unknown) =>
    fetch(`${base}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('answers the health route', async () => {
    const r = await fetch(`${base}/api/health`);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true });
  });

  it('answers 503 while the server key is not set, and never names its value', async () => {
    delete env.EXAMPLE_API_KEY;
    const r = await post('/api/example', { text: 'hello' });
    expect(r.status).toBe(503);
  });

  it('reads the server key on each request', async () => {
    env.EXAMPLE_API_KEY = 'a-key-for-the-test';
    const r = await post('/api/example', { text: 'hello' });
    expect(r.status).toBe(200);
    const text = await r.text();
    expect(JSON.parse(text)).toEqual({ length: 5 });
    expect(text).not.toContain('a-key-for-the-test');
  });

  it('answers 404 for a route it does not have', async () => {
    const r = await fetch(`${base}/api/nothing-here`);
    expect(r.status).toBe(404);
  });

  it('trims a server key and treats an empty one as not set', () => {
    expect(serverKey('K', { K: '  ' })).toBeNull();
    expect(serverKey('K', { K: ' v ' })).toBe('v');
  });
});
