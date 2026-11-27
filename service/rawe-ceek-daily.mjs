// A leased service of desktop-kit's local service (desktop-kit/service): a timed job that runs on the one machine
// holding the app's lease (the mini PC, else the user's PC), so it runs once a day however many PCs have it on.
// Added once on each machine (README, "The local service"); off until it is switched on there. The top level only
// defines: the module is imported only while the switch has it on.
import { defineService } from 'desktop-kit/service';

/**
 * The environment variable that holds the PATH of the Firebase service account's key file (RW.RESEARCH 6.5, option A):
 * the writer of series/**, meta/** and dueNotifications/** (RW.DATA). The user sets it once on the PC; the key file
 * stays outside every repository. Never a key store, never the key's content in a variable or a log.
 */
export const FIREBASE_KEY_FILE_VARIABLE = 'RAWE_CEEK_FIREBASE_KEY_FILE';

/** The key file's path, or null when the variable is not set. The file itself is read only where the service signs in. */
export const firebaseKeyFile = (env = process.env) => env[FIREBASE_KEY_FILE_VARIABLE]?.trim() || null;

export default defineService({
  name: 'rawe-ceek-daily',
  app: 'rawe-ceek',
  kind: 'leased',
  description: 'the daily job of Rawe Ceek',
  start(ctx) {
    if (!firebaseKeyFile()) ctx.log.warn(`${FIREBASE_KEY_FILE_VARIABLE} is not set: the daily job cannot write to Firestore`);
    /** @type {{ at: string, ok: boolean } | null} */
    let last = null;
    ctx.daily('04:00', async (signal) => {
      // the job's work goes here (a scraper through desktop-kit/scraper, a Firestore write through the service's
      // account); it stops when `signal` aborts
      if (signal.aborted) return;
      last = { at: new Date().toISOString(), ok: true };
      ctx.log.info('the daily job ran');
    }, { name: 'daily' });
    return {
      // GET http://127.0.0.1:47380/services/rawe-ceek-daily/last
      http: (req, res, next) => {
        if (req.method !== 'GET' || req.url !== '/last') return next();
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(last));
      },
    };
  },
});
