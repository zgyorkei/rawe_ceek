import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import type { Db } from 'desktop-kit/sync';
import { firebase, firebaseConfig, signIn, signOutOf, watchUser } from '../lib/firebase';
import { SERIES_IDS, SERIES_NAMES, watchSeason, watchSyncMeta, type SeasonDoc, type SeriesId, type SyncMeta } from '../lib/raceData';

// The scaffold's one data page: the six series with the rounds of this year's season and when the desktop service last
// synced. The real calendar, list and day popup come with RW.VIEWS; this page proves the sign-in and the read path.

const YEAR = new Date().getFullYear();

function SeriesRow({ db, series }: { db: Db; series: SeriesId }) {
  const [season, setSeason] = useState<SeasonDoc | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => watchSeason(db, series, YEAR, setSeason, (err) => setError(err.message)), [db, series]);
  let state = 'reading';
  if (error) state = error;
  else if (season === null) state = 'not synced yet';
  else if (season) state = `${season.rounds.length} rounds`;
  return <li><strong>{SERIES_NAMES[series]}</strong> {YEAR}: {state}</li>;
}

export default function Series() {
  const fb = firebase();
  const [user, setUser] = useState<User | null>(null);
  const [meta, setMeta] = useState<SyncMeta | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => (fb ? watchUser(fb, setUser) : undefined), [fb]);
  useEffect(() => {
    if (!fb || !user) return undefined;
    return watchSyncMeta(fb.db, setMeta, (err) => setError(err.message));
  }, [fb, user]);

  if (!fb) return <section><h1>Series</h1><p>Firebase is not set up: {firebaseConfig().problem}.</p></section>;
  if (!user) {
    return (
      <section>
        <h1>Series</h1>
        <button type="button" onClick={() => void signIn(fb).catch((err: Error) => setError(err.message))}>Sign in with Google</button>
        {error && <p role="alert">{error}</p>}
      </section>
    );
  }
  return (
    <section>
      <h1>Series</h1>
      <p>
        Signed in as {user.email} <button type="button" onClick={() => void signOutOf(fb)}>Sign out</button>
      </p>
      <p>{meta ? `Last synced ${meta.lastSyncAt}` : meta === null ? 'The desktop service has not synced yet.' : 'Reading the sync time.'}</p>
      {error && <p role="alert">{error}</p>}
      <ul className="series">
        {SERIES_IDS.map((id) => <SeriesRow key={id} db={fb.db} series={id} />)}
      </ul>
    </section>
  );
}
