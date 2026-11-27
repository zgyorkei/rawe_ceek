import { doc, getDoc, onSnapshot, setDoc } from 'firebase/firestore';
import { saved } from 'pwa-kit/offline';
import type { Db } from 'desktop-kit/sync';

// The race data model (RW.RESEARCH 6.2 and 2.2), the page's side of it. The desktop service writes series/** and
// meta/** as a service account; the page only reads them (firestore.rules: `write: if false` for every client) and
// writes only its own settings and push subscriptions. Every path is a plain slash path built here, so the rules, the
// service and the tests name the same documents.
//
//   series/{seriesId}                                   name, current season
//   series/{seriesId}/seasons/{year}                    ONE document: the season and rounds[] with sessions[] embedded
//   series/{seriesId}/seasons/{year}/results/{sessionId}   one document per session
//   series/{seriesId}/seasons/{year}/standings/{kind}      drivers, teams
//   meta/sync                                           last sync time, per-series version, source notes
//   settings/notifications                              the page writes
//   pushSubscriptions/{deviceId}                        the page writes
//   dueNotifications/{id}                               server only: no client access, so nothing here reads it

/** The six series, in the order the menu lists them. The ids are Firestore document ids. */
export const SERIES_IDS = ['f1', 'f2', 'f3', 'f1academy', 'wec', 'fe'] as const;
export type SeriesId = (typeof SERIES_IDS)[number];

export const SERIES_NAMES: Readonly<Record<SeriesId, string>> = {
  f1: 'Formula 1',
  f2: 'Formula 2',
  f3: 'Formula 3',
  f1academy: 'F1 Academy',
  wec: 'FIA WEC',
  fe: 'Formula E',
};

export const isSeriesId = (value: string): value is SeriesId => (SERIES_IDS as readonly string[]).includes(value);

export const SESSION_KINDS = ['practice', 'qualifying', 'sprint-qualifying', 'sprint', 'race', 'hyperpole'] as const;
export type SessionKind = (typeof SESSION_KINDS)[number];
export type SessionClass = 'hypercar' | 'lmgt3' | 'lmp2' | 'none';
export type TimeConfidence = 'confirmed' | 'placeholder' | 'tbc';
export type SessionStatus = 'upcoming' | 'live' | 'completed' | 'cancelled';
export type ResultsState = 'none' | 'pending' | 'provisional' | 'final';
export type RoundStatus = 'scheduled' | 'live' | 'completed' | 'cancelled' | 'moved';
export type StandingsKind = 'drivers' | 'teams';

export interface Session {
  /** Unique inside the season: the id of the result document. */
  id: string;
  kind: SessionKind;
  /** As the source prints it, such as "Practice 1" or "Qualifying - LMGT3". */
  name: string;
  class?: SessionClass;
  /** The one stored instant (ISO 8601, UTC): the local and the viewer's times are computed from it. */
  startUtc: string;
  endUtc: string | null;
  /** The circuit-local date (YYYY-MM-DD): the cell of the calendar the session belongs to. */
  localDate: string;
  timeConfidence: TimeConfidence;
  status: SessionStatus;
  resultsState: ResultsState;
}

export interface Round {
  round: number;
  name: string;
  circuitName: string;
  city: string;
  country: string;
  /** ISO 3166-1 alpha-2, for the flag. */
  countryCode: string;
  /** IANA zone of the circuit. */
  timeZone: string;
  /** The circuit's key in the service's own table (service/sync/circuits.mjs): how rounds of two series are matched. */
  circuitKey?: string;
  lat: number | null;
  long: number | null;
  /** The weekend's circuit-local dates (YYYY-MM-DD). */
  startDate: string;
  endDate: string;
  status: RoundStatus;
  /** Another series racing the same weekend, such as `f2 round 13`. */
  sharedWith?: { series: SeriesId; round: number }[];
  artKeys?: { silhouette?: string; corner?: string };
  source: { name: string; url: string; fetchedAt: string };
  sessions: Session[];
}

export interface SeriesDoc {
  name: string;
  /** The key of the series' art (RW.ART). */
  artKey?: string;
  currentSeason: number;
}

export interface SeasonDoc {
  series: SeriesId;
  season: number;
  rounds: Round[];
  /** The content hash the desktop service wrote last: it writes a season only when this changes. */
  contentHash?: string;
}

export interface ResultRow {
  position: number | null;
  carNumber?: string;
  driverCode?: string;
  driverName: string;
  team: string;
  /** A time, a gap or a status such as DNF, as the source prints it. */
  timeOrGap: string;
  points?: number;
  laps?: number;
  class?: SessionClass;
}

export interface ResultDoc {
  state: 'provisional' | 'final';
  fetchedAt: string;
  rows: ResultRow[];
  /** One line from a fixed template over the rows (service/sync/texts.mjs), never AI written (decision D3). */
  summary?: string;
  /** The source as the app credits it, and where it was read. */
  source?: { name: string; url: string };
}

export interface StandingsDoc {
  kind: StandingsKind;
  /** The round after which the table holds. */
  afterRound: number;
  rows: { position: number; name: string; team?: string; points: number }[];
}

export interface SyncMeta {
  /** ISO 8601 UTC: when the desktop service last synced anything. */
  lastSyncAt: string;
  /** Per series: the version stamp of what was written last. */
  versions: Partial<Record<SeriesId, string>>;
  /** Free notes about the sources of the last sync. */
  sourceNotes?: string;
  /** ISO 8601 UTC: when the daily run last read the calendars. */
  lastCalendarAt?: string;
  /** What failed in the last run that wrote this document (a source's redesign, a site down), at most 20. */
  errors?: { series: SeriesId; at: string; what: string; message: string }[];
}

/** settings/notifications (RW.RESEARCH 5.4). Written by the page, applied by the sender. */
export interface NotificationSettings {
  timeZone: string;
  quietHours: { enabled: boolean; start: string; end: string };
  week: { weekday: number; time: string };
  leadLongMinutes: number;
  leadShortMinutes: number;
  sessionTypes: SessionKind[];
  series: Partial<Record<SeriesId, { week: boolean; long: boolean; short: boolean; result: boolean }>>;
}

// The paths.

export const seriesPath = () => 'series';
export const seriesDocPath = (series: SeriesId) => `series/${series}`;
export const seasonPath = (series: SeriesId, year: number) => `series/${series}/seasons/${year}`;
export const resultPath = (series: SeriesId, year: number, sessionId: string) => `${seasonPath(series, year)}/results/${sessionId}`;
export const standingsPath = (series: SeriesId, year: number, kind: StandingsKind) => `${seasonPath(series, year)}/standings/${kind}`;
export const syncMetaPath = () => 'meta/sync';
export const notificationSettingsPath = () => 'settings/notifications';
export const pushSubscriptionPath = (deviceId: string) => `pushSubscriptions/${deviceId}`;

/**
 * The paths a client may write (firestore.rules): the settings and the device's own subscription. Anything else is
 * refused by the rules, so the page never tries it.
 */
export const isClientWritable = (path: string) => path === notificationSettingsPath() || /^pushSubscriptions\/[^/]+$/.test(path);

// Reads and listeners. Offline, Firestore answers from its cache (desktop-kit/sync turns it on).

/** Listens to the season document of a series; `null` while the service has not written it. */
export function watchSeason(db: Db, series: SeriesId, year: number, listener: (season: SeasonDoc | null) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(doc(db, seasonPath(series, year)), (snap) => listener(snap.exists() ? (snap.data() as SeasonDoc) : null), onError);
}

/** Listens to meta/sync: when the desktop service last synced (the page shows it beside cached data). */
export function watchSyncMeta(db: Db, listener: (meta: SyncMeta | null) => void, onError: (err: Error) => void): () => void {
  return onSnapshot(doc(db, syncMetaPath()), (snap) => listener(snap.exists() ? (snap.data() as SyncMeta) : null), onError);
}

/** One read of a session's result, or `null` when the source gave none. */
export async function readResult(db: Db, series: SeriesId, year: number, sessionId: string): Promise<ResultDoc | null> {
  const snap = await getDoc(doc(db, resultPath(series, year, sessionId)));
  return snap.exists() ? (snap.data() as ResultDoc) : null;
}

/** One read of a standings table, or `null` when there is none yet. */
export async function readStandings(db: Db, series: SeriesId, year: number, kind: StandingsKind): Promise<StandingsDoc | null> {
  const snap = await getDoc(doc(db, standingsPath(series, year, kind)));
  return snap.exists() ? (snap.data() as StandingsDoc) : null;
}

/** Saves the notification settings (the owner's page; the rules let only the owner write them). */
export function saveNotificationSettings(db: Db, settings: NotificationSettings): void {
  void saved(setDoc(doc(db, notificationSettingsPath()), settings));
}
