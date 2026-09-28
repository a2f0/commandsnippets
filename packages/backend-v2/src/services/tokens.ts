/**
 * Auth tokens (DRF's authtoken): one key per user, shared by all of their
 * browsers.
 */
import {and, eq, type SQL} from 'drizzle-orm';
import type {Db} from '../db/client';
import {tokens, type User, users} from '../db/schema';
import {now} from '../lib/clock';

/** DRF's Token.generate_key(): 20 random bytes, hex encoded. */
function generateKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return [...bytes].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** A new token row for `userId` (an id, or a subquery that selects one). */
export function newToken(userId: number | SQL) {
  return {key: generateKey(), created: now(), user_id: userId};
}

/** The active user a token belongs to; a deactivated account's token is ignored. */
export async function userForKey(db: Db, key: string): Promise<User | null> {
  const [row] = await db
    .select({user: users})
    .from(tokens)
    .innerJoin(users, eq(tokens.user_id, users.id))
    .where(and(eq(tokens.key, key), eq(users.is_active, true)))
    .limit(1);
  return row?.user ?? null;
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
  const token = newToken(userId);
  await db.insert(tokens).values(token).onConflictDoNothing();
  const [row] = await db
    .select({key: tokens.key})
    .from(tokens)
    .where(eq(tokens.user_id, userId));
  return row?.key ?? token.key;
}
