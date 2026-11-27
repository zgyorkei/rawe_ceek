import { useEffect, useSyncExternalStore } from 'react';
import { NavLink, useLocation } from 'react-router';
import type { NavStore } from 'pwa-kit/nav';
import { nav as pageNav } from '../lib/nav';

/**
 * The main navigation in the mode pwa-kit/nav picks by the window's width: 'bar' at the foot (the phone), 'rail' at the
 * side, 'rail-expanded' with the labels (a PC-sized window). The router's location is handed to the store, so the
 * active destination follows it.
 */
export default function Nav({ store = pageNav }: { store?: NavStore | null }) {
  const location = useLocation();
  useEffect(() => { store?.go(`${location.pathname}${location.search}`); }, [store, location.pathname, location.search]);
  const state = useSyncExternalStore(store?.subscribe ?? noSubscribe, () => store?.now() ?? null);
  if (!state || state.mode === 'none') return null;
  return (
    <nav className={`nav nav-${state.mode}`} aria-label="Main">
      {state.visible.map((d) => (
        <NavLink key={d.id} to={d.route} end={d.route === '/'} className={state.active?.id === d.id ? 'active' : undefined}>
          {d.label}
        </NavLink>
      ))}
    </nav>
  );
}

const noSubscribe = () => () => undefined;
