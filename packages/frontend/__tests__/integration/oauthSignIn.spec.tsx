/**
 * Signing in through an OAuth callback. The API's answer to the login sets
 * the LoggedIn cookie after the page (and its cookie reader, react-cookie's
 * `CookiesProvider`) has loaded: the entries page must see it, not take the
 * missing cookie for a sign-out and send the user back to sign in again.
 */
import {screen} from '@testing-library/react';
import {type MockInstance, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {serveMockApi} from '../util/msw';
import {store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();

/** Store `cookie` as the browser stores a response's Set-Cookie. */
function storeCookie(cookie: string) {
  // biome-ignore lint/suspicious/noDocumentCookie: jsdom has no Cookie Store API.
  document.cookie = cookie;
}

let consoleWarn: MockInstance<typeof console.warn>;
beforeEach(() => {
  // The mock API announces each request; the callback logs its scope.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  consoleWarn = vi.spyOn(console, 'warn');
});
afterEach(() => {
  storeCookie('LoggedIn=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/');
  vi.restoreAllMocks();
});

const callbacks = {
  github: 'code=oauth-code&state=xyz',
  google: `code=oauth-code&scope=${encodeURIComponent(
    'https://www.googleapis.com/auth/userinfo.email'
  )}&state=xyz`,
};

describe('Signing in', () => {
  it.each(['github', 'google'] as const)(
    'through %s takes one login',
    async provider => {
      // The login's answer sets the cookie.
      const login = async () => {
        storeCookie('LoggedIn=true; path=/');
      };
      vi.spyOn(apiClient, 'githubLogin').mockImplementation(login);
      vi.spyOn(apiClient, 'googleLogin').mockImplementation(login);
      const path = `/oauth/${provider}?${callbacks[provider]}`;
      window.history.pushState({}, '', path);
      window.sessionStorage.setItem('oauth_state', 'xyz');
      await renderAppAt(path, {act: true});

      // The user's data syncs: they are still signed in.
      expect(await screen.findByText('test-tag-1')).toBeInTheDocument();
      expect(store.loggedInUser).toBe(TEST_USER);
      expect(document.getElementById('signInPage')).toBeNull();
      expect(consoleWarn).not.toHaveBeenCalledWith('Cookie logout occurred.');
    }
  );
});
