import { useCallback, useEffect, useState } from 'react';
import { APP } from '../../app.config';
import {
  fetchNow,
  ownServices,
  serviceHealth,
  syncStatus,
  SYNC_SERVICE,
  type FetchNowResult,
  type ServiceHealth,
  type SyncRun,
  type SyncStatus,
} from '../lib/localService';
import { isSeriesId, SERIES_NAMES } from '../lib/raceData';

/** What the local service on this PC does for the app: whether it answers, who holds the app's lease, its services. */
export default function ThisPc() {
  const [health, setHealth] = useState<ServiceHealth | null | undefined>(undefined);
  useEffect(() => {
    let live = true;
    const check = () => void serviceHealth().then((h) => { if (live) setHealth(h); });
    check();
    const timer = setInterval(check, 30_000);
    return () => { live = false; clearInterval(timer); };
  }, []);

  if (health === undefined) return <section><h1>This PC</h1><p>Asking the local service...</p></section>;
  if (health === null) {
    return (
      <section>
        <h1>This PC</h1>
        <p>
          The local service does not answer here. On a phone that is expected. On a PC, see the README's "The local
          service": it runs {APP.name}'s jobs and the work Chrome cannot do, and Chrome asks once whether this site may
          reach it.
        </p>
      </section>
    );
  }
  const services = ownServices(health);
  return (
    <section>
      <h1>This PC</h1>
      <p>
        {health.machine.name}: {health.app?.holdsLease ? 'runs this app\'s timed jobs (it holds the lease).' : `the timed jobs run on ${health.app?.holder?.name ?? 'no machine yet'}.`}
      </p>
      {services.length === 0 ? (
        <p>None of {APP.name}'s services is added on this PC.</p>
      ) : (
        <ul>
          {services.map((s) => <li key={s.name}>{s.name} ({s.kind}): {s.state}</li>)}
        </ul>
      )}
      <SyncPanel health={health} />
    </section>
  );
}

const when = (iso: string) => new Date(iso).toLocaleString();
const seriesName = (id: string | null) => (id === null ? 'The sync' : isSeriesId(id) ? SERIES_NAMES[id] : id);

/** One run's line: when it ended, what it wrote, whether it failed. */
function RunLine({ label, run }: { label: string; run: SyncRun | null }) {
  if (!run) return <li>{label}: none yet.</li>;
  const outcome = run.ok ? `${run.written} document(s) written` : 'failed';
  const by = run.trigger === 'fetch-now' ? ', by Fetch now' : '';
  return <li>{label}: {when(run.endedAt)}, {outcome}{run.errors.length ? `, ${run.errors.length} error(s)` : ''}{by}.</li>;
}

/**
 * The data sync (service/rawe-ceek-daily.mjs): its last fetch, its errors and a Fetch now button. A leased service's
 * routes answer only on the PC that holds the lease, so on any other PC the panel says where the sync runs.
 */
function SyncPanel({ health }: { health: ServiceHealth }) {
  const added = ownServices(health).some((s) => s.name === SYNC_SERVICE);
  const here = health.app?.holdsLease === true;
  const [status, setStatus] = useState<SyncStatus | null | undefined>(undefined);
  const [asked, setAsked] = useState<FetchNowResult | null>(null);

  const refresh = useCallback(() => syncStatus().then(setStatus), []);
  useEffect(() => {
    if (!added || !here) return;
    let live = true;
    const check = () => void syncStatus().then((s) => { if (live) setStatus(s); });
    check();
    const timer = setInterval(check, status?.running ? 5_000 : 30_000);
    return () => { live = false; clearInterval(timer); };
  }, [added, here, status?.running]);

  const onFetchNow = async () => {
    setAsked(await fetchNow());
    await refresh();
  };

  if (!added) return <><h2>The data sync</h2><p>The sync ({SYNC_SERVICE}) is not added on this PC.</p></>;
  if (!here) {
    return (
      <>
        <h2>The data sync</h2>
        <p>
          The sync runs on {health.app?.holder?.name ?? 'the PC that holds the lease (none holds it yet)'}: its last
          fetch, its errors and Fetch now are on that PC's This PC page.
        </p>
      </>
    );
  }
  if (status === undefined) return <><h2>The data sync</h2><p>Asking the sync...</p></>;
  if (status === null) return <><h2>The data sync</h2><p>The sync does not answer on this PC yet (it may be starting, or switched off).</p></>;

  const errors = status.last?.errors ?? [];
  return (
    <>
      <h2>The data sync</h2>
      <ul>
        <RunLine label="Last fetch" run={status.last} />
        <RunLine label="Last daily run" run={status.lastCalendar} />
        <li>
          Schedule: the calendars at {status.schedule.dailyAt} every day, the results every {status.schedule.resultsEveryMinutes} minutes
          while a session's results are due.
        </li>
        <li>Series: {status.series.map(seriesName).join(', ')}.</li>
        <li>{status.keySet ? 'The writer\'s key file is set.' : 'RAWE_CEEK_FIREBASE_KEY_FILE is not set on this PC: nothing is written (README, step 4).'}</li>
        <li>{status.aiRepair ? 'The WEC\'s AI repair is on.' : 'The WEC\'s AI repair is off (RAWE_CEEK_GEMINI_API_KEY not set; optional).'}</li>
      </ul>
      {errors.length > 0 && (
        <>
          <h3>Errors of the last fetch</h3>
          <ul>
            {errors.map((e, i) => <li key={i}>{seriesName(e.series)}, {e.what}: {e.message}</li>)}
          </ul>
        </>
      )}
      <p>
        <button type="button" onClick={() => void onFetchNow()} disabled={status.running !== null}>
          {status.running ? `Fetching (${status.running.kind})...` : 'Fetch now'}
        </button>
        {asked === 'running' && ' A run is under way already.'}
        {asked === 'unreachable' && ' The sync did not answer.'}
      </p>
    </>
  );
}
