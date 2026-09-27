import {eq} from 'drizzle-orm';
import type {Context} from 'hono';
import {setCookie} from 'hono/cookie';
import type {Db} from '../db/client';
import {tokens, type User, users} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {notAuthenticated} from '../lib/errors';

/** Django's AUTH_COOKIE_MAX_AGE: 28 days. */
export const AUTH_COOKIE_MAX_AGE = 2_419_200;

/** DRF's Token.generate_key(): 20 random bytes, hex encoded. */
export function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

async function userForKey(db: Db, key: string): Promise<User | null> {
  const [row] = await db
    .select({user: users})
    .from(tokens)
    .innerJoin(users, eq(tokens.user_id, users.id))
    .where(eq(tokens.key, key))
    .limit(1);
  return row?.user ?? null;
}

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
 * The Django `CustomAuthentication` class: the `Authorization` cookie wins if
 * present (even when invalid); otherwise an `Authorization: <scheme> <key>`
 * header.
 */
export async function authenticate(c: Context<AppEnv>): Promise<User | null> {
  const db = c.get('db');
  const cookies = authorizationCookies(
    c.req.header('Cookie'),
    cookieNames(c).auth
  );
  if (cookies.length > 0) {
    // Staging's host-only cookie arrives alongside production's domain-wide
    // one (same name), in browser-defined order: accept the first valid key.
    for (const key of cookies) {
      const user = await userForKey(db, key);
      if (user !== null) {
        return user;
      }
    }
    return null;
  }
  const header = c.req.header('Authorization');
  if (header !== undefined) {
    const parts = header.split(/\s+/).filter(part => part !== '');
    return parts.length === 2 ? userForKey(db, parts[1] as string) : null;
  }
  return null;
}

/** DRF's IsAuthenticated: anonymous requests get a 403. */
export function requireUser(c: Context<AppEnv>): User {
  const user = c.get('user');
  if (user === null) {
    throw notAuthenticated();
  }
  return user;
}

/** Token.objects.get_or_create(user=user) */
export async function getOrCreateToken(
  db: Db,
  userId: number
): Promise<string> {
  const [existing] = await db
    .select({key: tokens.key})
    .from(tokens)
    .where(eq(tokens.user_id, userId));
  if (existing !== undefined) {
    return existing.key;
  }
  const key = generateKey();
  await db
    .insert(tokens)
    .values({key, created: now(), user_id: userId})
    .onConflictDoNothing();
  const [row] = await db
    .select({key: tokens.key})
    .from(tokens)
    .where(eq(tokens.user_id, userId));
  return row?.key ?? key;
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

/** Django's cookie names, used for cleaning up pre-migration cookies. */
const DJANGO_COOKIES = ['Authorization', 'LoggedIn'] as const;

function expire(c: Context<AppEnv>, name: string, domain: {domain?: string}) {
  setCookie(c, name, '', {
    path: '/',
    maxAge: 0,
    expires: new Date(0),
    ...domain,
  });
}

/**
 * Expire host-only copies of the auth cookies when cookies are domain-scoped.
 * Django's staging ran with DEBUG on and set host-only cookies on the API
 * host; browsers keep those separately from the domain-scoped ones and send
 * the older one first, so left alone a pre-migration cookie would keep
 * authenticating (possibly as a different user) after logout or re-login.
 */
function expireLegacyHostOnly(c: Context<AppEnv>): void {
  if (cookieDomain(c).domain !== undefined) {
    for (const name of DJANGO_COOKIES) {
      expire(c, name, {});
    }
  }
}

/** Django's `_create_auth_response`: set the auth + LoggedIn cookies. */
export async function setAuthCookies(
  c: Context<AppEnv>,
  userId: number
): Promise<void> {
  const key = await getOrCreateToken(c.get('db'), userId);
  const options = cookieOptions(c);
  expireLegacyHostOnly(c);
  const names = cookieNames(c);
  setCookie(c, names.auth, key, {...options, httpOnly: true});
  setCookie(c, names.loggedIn, 'true', {...options, httpOnly: false});
}

/**
 * Expire both cookies. Unlike Django's `delete_cookie`, this repeats the
 * domain the cookies were set with; without it browsers keep the
 * domain-scoped production cookies and logout doesn't stick. Legacy host-only
 * copies are expired too.
 */
export function clearAuthCookies(c: Context<AppEnv>): void {
  expireLegacyHostOnly(c);
  const names = cookieNames(c);
  for (const name of [names.auth, names.loggedIn]) {
    expire(c, name, cookieDomain(c));
  }
}
