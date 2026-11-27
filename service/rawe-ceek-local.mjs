// A local service of desktop-kit's local service (desktop-kit/service): it answers on this PC only, never leased, for
// what the page cannot do in Chrome (a key that must stay on the PC, a file of this PC, a program to start). Added once
// on each machine (README, "The local service"); off until it is switched on there. The top level only defines: the
// module is imported only while the switch has it on.
import { defineService } from 'desktop-kit/service';

/**
 * The environment variable the service's key is read from, at run time on each use: the user sets it once on the PC
 * (README, "The local service"). Never a key store, never a file in the repository, never in the page.
 */
export const KEY_VARIABLE = 'RAWE_CEEK_LOCAL_KEY';

/** The key, or null when the variable is not set. */
export const localKey = (env = process.env) => env[KEY_VARIABLE]?.trim() || null;

export default defineService({
  name: 'rawe-ceek-local',
  app: 'rawe-ceek',
  kind: 'local',
  description: 'what Rawe Ceek does on this PC only',
  start(ctx) {
    if (!localKey()) ctx.log.warn(`${KEY_VARIABLE} is not set: the routes that need it answer 503`);
    return {
      // GET  http://127.0.0.1:47380/services/rawe-ceek-local/status: whether the key is set (never the key)
      // POST http://127.0.0.1:47380/services/rawe-ceek-local/example: the shape of a route that uses the key
      http: (req, res, next) => {
        const send = (/** @type {number} */ status, /** @type {unknown} */ body) => {
          res.writeHead(status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(body));
        };
        if (req.method === 'GET' && req.url === '/status') return send(200, { keySet: localKey() !== null });
        if (req.method === 'POST' && req.url === '/example') {
          const key = localKey();
          if (!key) return send(503, { error: `${KEY_VARIABLE} is not set on this PC` });
          // call the outside service here with `key`; never send the key back or log it
          ctx.log.info('the example route ran');
          return send(200, { ok: true });
        }
        return next();
      },
    };
  },
});
