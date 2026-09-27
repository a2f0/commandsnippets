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
 * The client-readable login cookie's name for an environment. Staging uses
 * its own names because production's `.commandsnippets.com` cookies are also
 * sent to staging hosts (see backend-v2's COOKIE_NAME_PREFIX).
 */
export function loggedInCookieName(environment: string): string {
  return environment === 'staging' ? 'StagingLoggedIn' : 'LoggedIn';
}
