import { useEffect, useState } from 'react';
import { APP } from '../../app.config';
import { ownServices, serviceHealth, type ServiceHealth } from '../lib/localService';

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
    </section>
  );
}
