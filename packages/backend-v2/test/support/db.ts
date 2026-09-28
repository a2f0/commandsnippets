/** The test database, and model reads (Django's refresh_from_db and friends). */
import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {createDb, type Db} from '../../src/db/client';
import {
  type Tag,
  type TagTextEntry,
  type TextEntry,
  tags,
  tagsEntries,
  textEntries,
  tokens,
  type User,
  users,
} from '../../src/db/schema';

export const db = (): Db => createDb(env.DB);

export async function refreshTag(id: number): Promise<Tag | undefined> {
  return (await db().select().from(tags).where(eq(tags.id, id)))[0];
}

export async function refreshEntry(id: number): Promise<TextEntry | undefined> {
  return (
    await db().select().from(textEntries).where(eq(textEntries.id, id))
  )[0];
}

export async function refreshJunction(
  id: number
): Promise<TagTextEntry | undefined> {
  return (
    await db().select().from(tagsEntries).where(eq(tagsEntries.id, id))
  )[0];
}

export async function refreshUser(id: number): Promise<User | undefined> {
  return (await db().select().from(users).where(eq(users.id, id)))[0];
}

export async function userByUsername(
  username: string
): Promise<User | undefined> {
  return (
    await db().select().from(users).where(eq(users.username, username))
  )[0];
}

export async function tokenFor(userId: number): Promise<string> {
  const [token] = await db()
    .select({key: tokens.key})
    .from(tokens)
    .where(eq(tokens.user_id, userId));
  if (token === undefined) {
    throw new Error(`No token for user ${userId}`);
  }
  return token.key;
}

/** `user.tags.all()` in the model's default ordering (date_updated, id). */
export async function tagsOf(user: User): Promise<Tag[]> {
  const rows = await db().select().from(tags).where(eq(tags.user_id, user.id));
  return rows.sort(byUpdated);
}

/** `user.text_entries.all()` in default ordering. */
export async function entriesOf(user: User): Promise<TextEntry[]> {
  const rows = await db()
    .select()
    .from(textEntries)
    .where(eq(textEntries.user_id, user.id));
  return rows.sort(byUpdated);
}

export async function junctionsOf(entry: TextEntry): Promise<TagTextEntry[]> {
  const rows = await db()
    .select()
    .from(tagsEntries)
    .where(eq(tagsEntries.text_entry_id, entry.id));
  return rows.sort(byUpdated);
}

function byUpdated(
  a: {date_updated: string; id: number},
  b: {date_updated: string; id: number}
): number {
  if (a.date_updated !== b.date_updated) {
    return a.date_updated < b.date_updated ? -1 : 1;
  }
  return a.id - b.id;
}

/** Python's `datetime.isoformat()` of a stored timestamp. */
export {isoformat} from '../../src/lib/clock';
