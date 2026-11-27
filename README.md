# Rawe Ceek

Rawe Ceek is a racing calendar PWA for Formula 1, Formula 2, Formula 3, F1 Academy, the FIA WEC and Formula E, for private use. The RW work items build it: research and design first, then the app. The folder, the repository and the npm package are `rawe_ceek`; the display name is "Rawe Ceek" (`app.config.ts`, `APP.title`, the one place it is stated); the app id, the service names and the Vercel domain are `rawe-ceek`, because desktop-kit's app names allow only lower case letters, digits and hyphens (a host name cannot hold an underscore).

Made by `desktop-kit create` (desktop-kit's README, "A new app"). One app on every device: the web app on its Vercel site, installed from Chrome as an app window on the PC and on the home screen of a phone. On a PC the app window shows the desktop layout and does everything a desktop app does (desktop-kit's README, "The standard: the Chrome app matches the desktop app"); what a browser cannot do (the scraping, the sync into Firestore) runs in desktop-kit's local service on the PC. There is no Electron shell and no `desktop/` folder: the PC uses the PWA in Chrome plus the local service and its tray (decision D13).

| Part | Where |
| --- | --- |
| The page (Vite, React, react-router) | `index.html`, `src/` |
| The PWA (manifest, worker, install, update, navigation) | `pwa.config.ts`, `src/sw.ts`, from pwa-kit |
| The server routes (Vercel) | `api/index.ts`, `lib/api.ts` |
| The data (Firestore, Google sign-in) | `src/lib/firebase.ts`, `src/lib/raceData.ts`, `firestore.rules`, from desktop-kit/sync |
| What runs on the PC (the sync, the scrapers, the writer's key) | `service/`, on desktop-kit's local service |
| The name, the title and the port | `app.config.ts` |

**The port is 47341** (strict, on 127.0.0.1): Brick Tracker 47321, SmakMal 47331, Rawe Ceek 47341, the local service 47380. It is the next free one after desktop-kit's list; the kit's README, "Ports", gets the row `| Rawe Ceek | 47341 |` when the kit is next changed.

## Every day

```powershell
npm run dev
```

The page and the API on http://127.0.0.1:47341/ with hot reload. The port never moves to another one, so the browser's storage, the installed app and the local service's origins stay the same.

```powershell
npm run app
```

The app in its own window (Chrome, else Edge), 1400 x 900, in the desktop layout. `APP_URL` opens another address (the Vercel site), `APP_ID` the installed app.

```powershell
npm run check
```

The type check, the tests and the web build (`dist/`). `npm run preview` serves the build on the same port.

## The data

The race data is in Firestore, so the phone and every PC see the same calendar and the same results (`src/lib/raceData.ts` has the types and the paths; RW.RESEARCH 6.2 has the reasons):

```text
series/{seriesId}                                       f1, f2, f3, f1academy, wec, fe
series/{seriesId}/seasons/{year}                        ONE document: the season and rounds[] with sessions[] embedded
series/{seriesId}/seasons/{year}/results/{sessionId}    one document per session
series/{seriesId}/seasons/{year}/standings/{kind}       drivers, teams
meta/sync                                               last sync time, per-series version, source notes
settings/notifications                                  the page writes
pushSubscriptions/{deviceId}                            the page writes
dueNotifications/{id}                                   server only: no client access
```

The desktop service writes `series/**`, `meta/**` and `dueNotifications/**` as a Google service account (IAM, which the rules do not apply to). The page reads them and writes only `settings/**` and `pushSubscriptions/**`.

### The rules (`firestore.rules`)

- The owner is pinned by a uid placeholder, `OWNER_UID_PLACEHOLDER`. **Never commit the real uid**: paste it into the copy you publish in the console (step 1 below). The test `test/rules.test.ts` fails when the file in the repository holds anything but the placeholder. While the placeholder stays, every read and write is refused.
- `series/**` and `meta/**`: read by the owner, `write: if false` for every client.
- `settings/**` and `pushSubscriptions/**`: read and write by the owner.
- Everything else is denied.
- The read rule of race data is ONE function, `canRead()`, owner only for now. Who else may read it (a phone that is not signed in, a second family account) is not decided: RW.RESEARCH 6.3 gives the options, and the answer changes only that function.

## The kits

`desktop-kit` and `pwa-kit` are in `vendor/` as tarballs, pinned by `file:vendor/...` in `package.json`, because Vercel clones only this repository. **This is temporary:** once the kits have release tags (DK.RELEASE), `package.json` pins the tags instead, and `vendor/` and `scripts/kits-refresh.mjs` go. Until then, a newer kit is taken in by:

```powershell
npm run kits:refresh
npm install
```

It builds and packs the sibling checkouts `..\desktop-kit` and `..\pwa-kit` (`--desktop-kit <dir>`, `--pwa-kit <dir>` or `DESKTOP_KIT_DIR`, `PWA_KIT_DIR` for others). Commit `vendor/`, `package.json` and `package-lock.json` together. Today's tarballs are desktop-kit 0.1.0 from its `item/APPS.TEMPLATE` and pwa-kit 0.4.0 from its `item/PWA-KIT.MERGE-CHAIN` (the template uses `pwa-kit/browser` and `pwa-kit/launch`, which pwa-kit's master does not have yet).

## The first setup, once (your steps)

Nothing below is done by the code: you create the projects and set the variables. RW.LIVE waits for these.

### 1. The Firebase project

1. In the Firebase console (https://console.firebase.google.com), add a project for Rawe Ceek, **with your personal Google account** (an organisation's policy can block the service account key of step 4).
2. **Authentication** > Sign-in method: switch on **Google**.
3. **Firestore Database**: create the database (a region near you; production mode). For a named database rather than `(default)`, put its id in `VITE_FIREBASE_DATABASE_ID`.
4. **Project settings** > Your apps: add a **web app**. Its config goes into `.env` (copy `.env.example`) as the `VITE_FIREBASE_*` values. That config is public by design: the rules guard the data.
5. Sign in once with Google (`npm run dev`, the Series page). **Authentication** > Users then shows your **uid**.
6. **Firestore** > Rules: paste `firestore.rules`, replace `OWNER_UID_PLACEHOLDER` with your uid in the console's copy only, and publish.

### 2. The Vercel project

1. In Vercel, **Add New** > Project, and import this repository (GitHub, `origin`). The framework is Vite; `vercel.json` sends `/api/*` to `api/index.ts` and every other path to the page.
2. **Settings** > Environment Variables: the same `VITE_FIREBASE_*` values as in `.env`, and each server key the app adds (`EXAMPLE_API_KEY` is the template's example; RW.NOTIFY replaces it) for Production and Preview. A server key is read at run time by `lib/api.ts`: it is never a `VITE_` variable, never in `src/` and never in the page.
3. Deploy. The site's address (such as `https://rawe-ceek.vercel.app`) is the app's address from now on.

### 3. Google sign-in: the authorized domains and the OAuth client

Firebase **Authentication** > Settings > **Authorized domains**: add the Vercel site's domain. `localhost` is there already; add `127.0.0.1` for `npm run dev`. Firebase's Google sign-in makes its own OAuth client, so the page needs none of your own. (A Google OAuth client, "desktop app" type, is needed only if a later item adds a sign-in on the PC itself; its file, `oauth-client.json`, is git-ignored.)

### 4. The writer's service account (the PC)

The desktop service writes the race data as a service account, never with a kept sign-in (no DPAPI, no Electron safeStorage, no Windows Credential Manager, no key store):

1. Google Cloud console, project of step 1: **IAM** > Service accounts > create `rawe-ceek-writer` with the one role **Cloud Datastore User** (`roles/datastore.user`).
2. Create a JSON key for it and save the file under your profile, **outside every repository** (the name must not end up in git: `*-key.json` and `*service-account*.json` are ignored).
3. Set the path, once, as a user environment variable on the PC that runs the service:

   ```powershell
   [Environment]::SetEnvironmentVariable('RAWE_CEEK_FIREBASE_KEY_FILE', '<the full path of the key file>', 'User')
   ```

   Only the path is in the variable. The service refuses to write while it is missing and never logs the key. Restart the service afterwards.

### 5. The first install

Open the Vercel site in Chrome on the PC and choose **Install** (the button on This PC, or the install icon in the address bar). On an Android phone, Chrome's menu > **Add to home screen**. From then on the app updates itself: a new deployment shows the update line, and **Reload** takes it.

### 6. The local service, on each PC

desktop-kit's README, "The local service", sets the service itself up once per machine. Then, in the desktop-kit folder of that machine:

```powershell
node bin/desktop-kit-service.mjs services add C:\git_personal\rawe_ceek\service\rawe-ceek-daily.mjs
node bin/desktop-kit-service.mjs services add C:\git_personal\rawe_ceek\service\rawe-ceek-local.mjs
node bin/desktop-kit-service.mjs origins add https://rawe-ceek.vercel.app
node bin/desktop-kit-service.mjs services on rawe-ceek-daily
node bin/desktop-kit-service.mjs services on rawe-ceek-local
```

The folder is where this repository is on that machine. Pages on `http://127.0.0.1:47341` need no `origins add`.

- **The daily job** (`rawe-ceek-daily`) is leased: it runs only on the machine holding the app's lease, once a day whichever PCs have it on (desktop-kit's README, "The shared lease"). `node bin/desktop-kit-service.mjs lease` shows the setting. It is a skeleton now; RW.DATA fills it in with the sync, using `RAWE_CEEK_FIREBASE_KEY_FILE`.
- **The local service** (`rawe-ceek-local`) answers on its own PC only. Its key comes from an environment variable you set once on that PC, never from a key store or a file:

  ```powershell
  [Environment]::SetEnvironmentVariable('RAWE_CEEK_LOCAL_KEY', '<the key>', 'User')
  ```

  The name is `KEY_VARIABLE` in the module. Restart the service (`stop`, then `start`) so it sees the new variable.

## The rules this app keeps

- Secrets are read at run time from the environment: `.env` here (never committed), Vercel's settings on the site, an environment variable on the PC for the local service and the writer's key path.
- No DPAPI, no Electron safeStorage, no Windows Credential Manager, no OS key store, anywhere. The template does not wire desktop-kit/google-signin's kept session; nothing here uses it.
- Links to other sites open in a Chrome tab (`src/components/ExternalLink.tsx`), never inside the app window.
- The navigation (`src/lib/nav.ts`, pwa-kit/nav) is a bar under 600 px, a rail from 600 and the expanded rail from 1200; every quick action in `pwa.config.ts` is one of its routes (the tests check it).
- No AI on Formula 1 group content (decision D3): the texts are templated.
