import {asc, eq, sql} from 'drizzle-orm';
import type {Db} from '../db/client';
import {isEmailViolation, isUniqueViolation} from '../db/errors';
import {tokens, type User, users} from '../db/schema';
import {now} from '../lib/clock';
import RESERVED_USERNAMES from './reserved-usernames.json';
import {newToken} from './tokens';

function randomDigits(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(byte => String(byte % 10)).join('');
}

/**
 * Insert a user together with their auth token (Django's post_save signal),
 * in one D1 batch so it is all-or-nothing. New accounts start with no tags or
 * entries.
 */
async function insertUserWithToken(
  db: Db,
  username: string,
  email: string
): Promise<User> {
  const joined = now();
  const userId = sql`(SELECT id FROM users_user WHERE username = ${username})`;

  await db.batch([
    db.insert(users).values({
      username,
      email,
      date_joined: joined,
      date_updated: now(),
      last_login: joined,
      last_active: joined,
      login_count: 1,
    }),
    db.insert(tokens).values(newToken(userId)),
  ]);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  return user as User;
}

const reserved = new Set(RESERVED_USERNAMES.map(name => name.toLowerCase()));

/**
 * Usernames are the web app's first path segment (`/:user/:tag`), so none may
 * be one of the app's own top-level routes (`/admin`, `/oauth/...`).
 * React Router matches paths case-insensitively, so neither may `Admin`.
 * The frontend checks its routes against `reserved-usernames.json`.
 */
export function isReservedUsername(username: string): boolean {
  return reserved.has(username.toLowerCase());
}

/**
 * Django's User.save() for new users: if the username is taken (or reserved),
 * append `-<random digits>`, growing the suffix until it is free.
 */
export async function createUser(
  db: Db,
  username: string,
  email: string
): Promise<User> {
  let candidate = username;
  for (let suffixLength = 1; suffixLength <= 20; suffixLength++) {
    const [taken] = isReservedUsername(candidate)
      ? [{id: 0}]
      : await db
          .select({id: users.id})
          .from(users)
          .where(eq(users.username, candidate))
          .limit(1);
    if (taken === undefined) {
      try {
        return await insertUserWithToken(db, candidate, email);
      } catch (error) {
        // Only a username clash is retried with a new name; an email clash
        // means the account exists, which the caller must handle.
        if (!isUniqueViolation(error) || isEmailViolation(error)) {
          throw error;
        }
      }
    }
    candidate = `${username}-${randomDigits(suffixLength)}`;
  }
  throw new Error(`Could not find a free username for ${username}`);
}

/**
 * users.utils.create_collisionless_user: get_or_create keyed on email. The
 * unique email index makes this atomic: when a concurrent first login creates
 * the account between our lookup and insert, the insert fails on the email
 * and we return the account it created instead of making a second one.
 */
export async function getOrCreateUser(
  db: Db,
  username: string,
  email: string
): Promise<{user: User; created: boolean}> {
  const find = async () =>
    (
      await db
        .select()
        .from(users)
        .where(eq(users.email, email))
        .orderBy(asc(users.id))
        .limit(1)
    )[0];
  const existing = await find();
  if (existing !== undefined) {
    return {user: existing, created: false};
  }
  try {
    return {user: await createUser(db, username, email), created: true};
  } catch (error) {
    const concurrent = isEmailViolation(error) ? await find() : undefined;
    if (concurrent === undefined) {
      throw error;
    }
    return {user: concurrent, created: false};
  }
}

/**
 * A returning user's login: bump last_login and login_count. A login is
 * activity too, whether or not the request carried a token.
 */
export async function recordLogin(db: Db, userId: number): Promise<void> {
  const at = now();
  await db
    .update(users)
    .set({
      last_login: at,
      last_active: at,
      login_count: sql`${users.login_count} + 1`,
    })
    .where(eq(users.id, userId));
}
