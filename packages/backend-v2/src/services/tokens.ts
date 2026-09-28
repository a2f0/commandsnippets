/**
 * Auth tokens (DRF's authtoken): one key per user, shared by all of their
 * browsers.
 */
import {and, eq, inArray, type SQL} from 'drizzle-orm';
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

/**
 * The active user a token belongs to; a deactivated account's token is ignored.
 * Every request authenticates, so this also bumps the user's `last_active`, in
 * the same statement as the lookup (no extra round trip to D1).
 */
export async function userForKey(db: Db, key: string): Promise<User | null> {
  const [user] = await db
    .update(users)
    .set({last_active: now()})
    .where(
      and(
        inArray(
          users.id,
          db
            .select({id: tokens.user_id})
            .from(tokens)
            .where(eq(tokens.key, key))
        ),
        eq(users.is_active, true)
      )
    )
    .returning();
  return user ?? null;
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
