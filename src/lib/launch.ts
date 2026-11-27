import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { onLaunch, routeOf, type LaunchEnv } from 'pwa-kit/launch';

/**
 * Moves the router to each launch of the installed app into its open window (a quick action, a link). The cold start
 * is skipped: the window was opened at that address already. Registered once.
 */
export function useLaunchNavigation(env?: LaunchEnv): void {
  const navigate = useNavigate();
  const latest = useRef(navigate);
  latest.current = navigate;
  useEffect(() => onLaunch((launch) => {
    if (!launch.cold) void latest.current(routeOf(launch));
  }, env), [env]);
}
