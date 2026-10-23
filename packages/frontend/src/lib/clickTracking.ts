import {createTracker, type Tracker} from '@a2f0/ct-client';

let tracker: Tracker | undefined;

/** Imports are inert; only the deployed browser bootstrap starts collection. */
export function initClickTracking(): Tracker | undefined {
  if (!import.meta.env.PROD || typeof window === 'undefined') return;
  const environment = import.meta.env.MODE;
  if (environment !== 'production' && environment !== 'staging') return;
  const origin =
    environment === 'production'
      ? 'https://app.commandsnippets.com'
      : 'https://app-staging.commandsnippets.com';
  if (location.origin !== origin) return;
  if (tracker) return tracker;

  tracker = createTracker({
    site: 'commandsnippets',
    app: 'web-app',
    environment,
    capture: 'all',
    overrideGpc: true,
    // App routes contain usernames and tag names. Never collect those paths.
    page: () => '/',
  });
  tracker.init();
  return tracker;
}
