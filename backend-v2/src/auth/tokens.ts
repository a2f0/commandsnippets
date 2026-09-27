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

/** Every `Authorization` cookie value in a Cookie header, in order. */
export function authorizationCookies(header: string | undefined): string[] {
  return (header ?? '')
    .split(';')
    .map(pair => pair.trim())
    .filter(pair => pair.startsWith('Authorization='))
    .map(pair => {
      const value = pair.slice('Authorization='.length);
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
  const cookies = authorizationCookies(c.req.header('Cookie'));
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

export type ClientType = 'web' | 'electron';

/**
 * The Domain attribute, if any. Local development (DEBUG) and an empty
 * COOKIE_DOMAIN mean host-only cookies; staging uses the latter so its cookies
 * never overwrite or clear production's `.commandsnippets.com` ones, which
 * share their names.
 */
function cookieDomain(c: Context<AppEnv>): {domain?: string} {
  const domain: string = c.env.COOKIE_DOMAIN;
  return c.env.DEBUG === 'true' || domain === '' ? {} : {domain};
}

function cookieOptions(c: Context<AppEnv>, clientType: ClientType) {
  const isLocalDev = c.env.DEBUG === 'true';
  const isElectron = clientType === 'electron';
  // Electron needs SameSite=None for cross-origin requests from its custom
  // protocol (e.g. tearleads-staging://app) to the API.
  const sameSite = isElectron ? 'None' : isLocalDev ? 'Lax' : 'Strict';
  return {
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE,
    sameSite,
    secure: isElectron || !isLocalDev,
    ...cookieDomain(c),
  } as const;
}

/** Django's `_create_auth_response`: set the auth + LoggedIn cookies. */
export async function setAuthCookies(
  c: Context<AppEnv>,
  userId: number,
  clientType: ClientType = 'web'
): Promise<void> {
  const key = await getOrCreateToken(c.get('db'), userId);
  const options = cookieOptions(c, clientType);
  setCookie(c, 'Authorization', key, {...options, httpOnly: true});
  setCookie(c, 'LoggedIn', 'true', {...options, httpOnly: false});
}

/**
 * Expire both cookies. Unlike Django's `delete_cookie`, this repeats the
 * domain the cookies were set with; without it browsers keep the
 * domain-scoped production cookies and logout doesn't stick.
 */
export function clearAuthCookies(c: Context<AppEnv>): void {
  const domain = cookieDomain(c);
  for (const name of ['Authorization', 'LoggedIn']) {
    setCookie(c, name, '', {
      path: '/',
      maxAge: 0,
      expires: new Date(0),
      ...domain,
    });
  }
}
