/** The auth cookies: Django's `Authorization` token cookie and `LoggedIn` hint. */
import type {Context} from 'hono';
import {setCookie} from 'hono/cookie';
import type {AppEnv} from '../env';
import {getOrCreateToken} from '../services/tokens';

/** Django's AUTH_COOKIE_MAX_AGE: 28 days. */
const AUTH_COOKIE_MAX_AGE = 2_419_200;

/**
 * This environment's auth cookie names. Staging prefixes them: production's
 * `.commandsnippets.com` cookies are sent to staging hosts too, and with
 * shared names a production token (valid if staging holds imported data)
 * could authenticate on staging and outlive a staging logout.
 */
export function cookieNames(c: Context<AppEnv>): {
  auth: string;
  loggedIn: string;
} {
  const prefix: string = c.env.COOKIE_NAME_PREFIX;
  return {auth: `${prefix}Authorization`, loggedIn: `${prefix}LoggedIn`};
}

/** Every value of cookie `name` in a Cookie header, in order. */
export function authorizationCookies(
  header: string | undefined,
  name = 'Authorization'
): string[] {
  return (header ?? '')
    .split(';')
    .map(pair => pair.trim())
    .filter(pair => pair.startsWith(`${name}=`))
    .map(pair => {
      const value = pair.slice(name.length + 1);
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    });
}

/**
 * The Domain attribute, if any. Local development (DEBUG) and an empty
 * COOKIE_DOMAIN mean host-only cookies. Staging and production share
 * `.commandsnippets.com` (their hosts are app-staging and app), so staging's
 * cookies are kept apart by name (COOKIE_NAME_PREFIX), not by domain.
 */
function cookieDomain(c: Context<AppEnv>): {domain?: string} {
  const domain: string = c.env.COOKIE_DOMAIN;
  return c.env.DEBUG === 'true' || domain === '' ? {} : {domain};
}

function cookieOptions(c: Context<AppEnv>) {
  const isLocalDev = c.env.DEBUG === 'true';
  return {
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
    sameSite: isLocalDev ? 'Lax' : 'Strict',
    secure: !isLocalDev,
    ...cookieDomain(c),
  } as const;
}

function expire(c: Context<AppEnv>, name: string, domain: {domain?: string}) {
  setCookie(c, name, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    ...domain,
  });
}

/** Django's `_create_auth_response`: set the auth + LoggedIn cookies. */
export async function setAuthCookies(
  c: Context<AppEnv>,
  userId: number
): Promise<void> {
  const key = await getOrCreateToken(c.get('db'), userId);
  const options = cookieOptions(c);
  const names = cookieNames(c);
  setCookie(c, names.auth, key, {...options, httpOnly: true});
  setCookie(c, names.loggedIn, 'true', {...options, httpOnly: false});
}

/**
 * Expire both cookies. Unlike Django's `delete_cookie`, this repeats the
 * domain the cookies were set with; without it browsers keep the
 * domain-scoped production cookies and logout doesn't stick.
 */
export function clearAuthCookies(c: Context<AppEnv>): void {
  const names = cookieNames(c);
  for (const name of [names.auth, names.loggedIn]) {
    expire(c, name, cookieDomain(c));
  }
}
