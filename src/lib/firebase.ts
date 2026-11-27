import { initializeApp, type FirebaseApp } from 'firebase/app';
import { GoogleAuthProvider, getAuth, onAuthStateChanged, signInWithPopup, signOut, type Auth, type User } from 'firebase/auth';
import * as firestore from 'firebase/firestore';
import { openFirestore, parseFirebaseConfig, type Db, type FirebaseWebConfig } from 'desktop-kit/sync';

// Firebase from the VITE_FIREBASE_* variables (.env here, the project's settings on Vercel). Without them the app
// still opens and says what is missing. Firestore comes through desktop-kit/sync: the app's own SDK passed in, the
// offline cache on.

export interface Firebase {
  app: FirebaseApp;
  auth: Auth;
  db: Db;
}

/** The web config from the build's variables, or null with the reason when one is missing or wrong. */
export function firebaseConfig(env: Record<string, string | undefined> = import.meta.env): { config: FirebaseWebConfig | null; problem: string | null } {
  if (!env.VITE_FIREBASE_PROJECT_ID) return { config: null, problem: 'VITE_FIREBASE_PROJECT_ID is not set (README, "The Firebase project")' };
  try {
    const config = parseFirebaseConfig({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    });
    return { config, problem: null };
  } catch (err) {
    return { config: null, problem: err instanceof Error ? err.message : String(err) };
  }
}

let opened: Firebase | null = null;

/** The app's Firebase, opened once; null when the config is missing. */
export function firebase(): Firebase | null {
  if (opened) return opened;
  const { config } = firebaseConfig();
  if (!config) return null;
  const app = initializeApp(config);
  const databaseId = import.meta.env.VITE_FIREBASE_DATABASE_ID || undefined;
  opened = { app, auth: getAuth(app), db: openFirestore(firestore, app, { databaseId }) };
  return opened;
}

export const signIn = (fb: Firebase) => signInWithPopup(fb.auth, new GoogleAuthProvider());
export const signOutOf = (fb: Firebase) => signOut(fb.auth);
export const watchUser = (fb: Firebase, listener: (user: User | null) => void) => onAuthStateChanged(fb.auth, listener);
