import {applySnapshot} from 'mobx-state-tree';
import {defaultState} from '../shared';
import {store} from '../store/store';

export function resetApplicationState() {
  applySnapshot(store, defaultState);
}

export function handleUnauthorized() {
  console.info('Unauthorized access detected, resetting application state');
  resetApplicationState();
}

/**
 * The client-readable login cookie names for an environment. Staging and
 * production share `.commandsnippets.com`, so staging has its own name
 * (backend-v2's COOKIE_NAME_PREFIX) and must never read production's
 * `LoggedIn`, which would show a signed-in UI with no staging session.
 */
export function loggedInCookieNames(environment: string): string[] {
  return environment === 'staging' ? ['StagingLoggedIn'] : ['LoggedIn'];
}

/**
 * Whether any of the environment's login cookies is set. This only drives UI
 * state; the httpOnly auth cookie is what the API checks.
 */
export function hasLoginCookie(
  cookies: Record<string, unknown>,
  environment: string
): boolean {
  return loggedInCookieNames(environment).some(name => Boolean(cookies[name]));
}
