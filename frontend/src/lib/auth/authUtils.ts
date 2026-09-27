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
 * The client-readable login cookie names for an environment, preferred
 * first. backend-v2 gives staging its own names (StagingLoggedIn) because
 * production's `.commandsnippets.com` cookies are also sent to staging hosts
 * (see its COOKIE_NAME_PREFIX). Staging still accepts Django's `LoggedIn`
 * so the frontend and API can switch over in either order.
 * TODO: drop the `LoggedIn` fallback on staging once backend-v2 serves it.
 */
export function loggedInCookieNames(environment: string): string[] {
  return environment === 'staging'
    ? ['StagingLoggedIn', 'LoggedIn']
    : ['LoggedIn'];
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
