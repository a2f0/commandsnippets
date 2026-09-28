import type {Context} from 'hono';
import type {User} from '../db/schema';
import type {AppEnv} from '../env';
import {userForKey} from '../services/tokens';
import {authorizationCookies, cookieNames} from './cookies';

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
