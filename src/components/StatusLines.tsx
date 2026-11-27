import { useState, useSyncExternalStore } from 'react';
import { install } from 'pwa-kit/install';
import { online, refusals } from 'pwa-kit/offline';
import { updates } from 'pwa-kit/update';

/** 'A new version is ready' with its Reload button: shown while a new version waits; it never reloads by itself. */
export function UpdateLine() {
  const ready = useSyncExternalStore(updates.subscribe, updates.ready);
  const [reloading, setReloading] = useState(false);
  if (!ready) return null;
  return (
    <div role="status" className="line line-update">
      <span>A new version is ready.</span>
      <button type="button" disabled={reloading} onClick={() => { setReloading(true); updates.reload(); }}>Reload</button>
    </div>
  );
}

/** Offline: changes are kept and sent once the connection is back. A change the server refused gets a line of its own. */
export function OfflineLine() {
  const isOnline = useSyncExternalStore(online.subscribe, online.now);
  const refusal = useSyncExternalStore(refusals.subscribe, refusals.now);
  return (
    <>
      {!isOnline && <div role="status" className="line line-offline">Offline: changes are kept and sent when the connection is back.</div>}
      {refusal && (
        <div role="alert" className="line line-refused">
          <span>A change was not saved: the server refused it.</span>
          <button type="button" onClick={refusals.clear}>Close</button>
        </div>
      )}
    </>
  );
}

/** Install the app (Chrome's own dialog), shown only while Chrome offers it. */
export function InstallButton() {
  const canPrompt = useSyncExternalStore(install.subscribe, install.canPrompt);
  const installed = useSyncExternalStore(install.subscribe, install.installed);
  if (!canPrompt || installed) return null;
  return <button type="button" onClick={() => void install.prompt()}>Install the app</button>;
}
