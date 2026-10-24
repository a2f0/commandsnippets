import {useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {hasLoginCookie, loggedInCookieNames} from '../lib/auth/authUtils';
import {environment} from '../lib/environment';
import {useAppConfig} from '../lib/state/appState';

const COOKIE_KEYS = loggedInCookieNames(environment);

/**
 * Sign the app out when the user has cleared their cookies (the login hint,
 * not the Authorization cookie holding the token): a page showing their
 * data (the entries page, an entry's) shows none of it without one, though
 * the API cannot be reached to say the session is gone.
 */
export function useCookieLogout(): void {
  const appConfig = useAppConfig();
  // Read `document.cookie` afresh on mount: CookiesProvider parsed it when the
  // page loaded, before a sign-in's API answer set the login cookie, and that
  // stale copy would sign the user straight back out.
  const [cookies] = useCookies(COOKIE_KEYS, {doNotUpdate: false});
  const loggedInCookie = hasLoginCookie(cookies, environment);
  const {loggedInUser, setLoggedInUser} = appConfig;

  useEffect(() => {
    if (!loggedInCookie && loggedInUser !== null) {
      console.warn('Cookie logout occurred.');
      setLoggedInUser(null);
    }
  }, [loggedInCookie, loggedInUser, setLoggedInUser]);
}
