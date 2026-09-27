import {asc, eq, sql} from 'drizzle-orm';
import {generateKey} from '../auth/tokens';
import type {Db} from '../db/client';
import {
  tags,
  tagsEntries,
  textEntries,
  tokens,
  type User,
  users,
} from '../db/schema';
import {now} from '../lib/clock';
import {searchColumns} from '../lib/search';
import {isUniqueViolation} from '../resources/viewset';

const EXAMPLE_ENTRIES = [
  {
    subject: 'close all postgres connections other than the current one',
    body:
      'SELECT pg_terminate_backend(pg_stat_activity.pid)\n' +
      'FROM pg_stat_activity\n' +
      'WHERE datname = current_database()\n' +
      'AND pid <> pg_backend_pid();\n',
  },
  {
    subject: 'show where a postgres session is originating from',
    body: "SELECT *\nFROM pg_stat_activity\nWHERE datname = 'postgres';",
  },
] as const;

const EXAMPLE_TAGS = [
  {name: 'example-postgres', order: 1},
  {name: 'example-tag-2', order: 2},
] as const;

/** [tag index, entry index, order] */
const EXAMPLE_JUNCTIONS = [
  [0, 0, 1],
  [0, 1, 2],
  [1, 1, 3],
] as const;

function randomDigits(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map(byte => String(byte % 10)).join('');
}

/**
 * Insert a user together with what Django's post_save signal created: an auth
 * token and example tags/entries. One D1 batch, so it is all-or-nothing.
 */
async function insertUserWithDefaults(
  db: Db,
  username: string,
  email: string
): Promise<User> {
  const joined = now();
  const userId = sql`(SELECT id FROM users_user WHERE username = ${username})`;
  const tagId = (name: string) =>
    sql`(SELECT id FROM tags_tag WHERE user_id = ${userId} AND name = ${name})`;
  const entryId = (subject: string) =>
    sql`(SELECT id FROM text_entries_textentry WHERE user_id = ${userId} AND subject = ${subject})`;

  await db.batch([
    db.insert(users).values({
      username,
      email,
      date_joined: joined,
      date_updated: now(),
      last_login: joined,
      login_count: 1,
    }),
    db
      .insert(tokens)
      .values({key: generateKey(), created: now(), user_id: userId}),
    ...EXAMPLE_TAGS.map(tag => {
      const timestamp = now();
      return db.insert(tags).values({
        ...tag,
        user_id: userId,
        date_created: timestamp,
        date_updated: timestamp,
        date_last_used: timestamp,
      });
    }),
    ...EXAMPLE_ENTRIES.map(entry => {
      const timestamp = now();
      return db.insert(textEntries).values({
        ...entry,
        ...searchColumns(entry),
        user_id: userId,
        date_created: timestamp,
        date_updated: timestamp,
      });
    }),
    ...EXAMPLE_JUNCTIONS.map(([tagIndex, entryIndex, order]) => {
      const timestamp = now();
      return db.insert(tagsEntries).values({
        tag_id: tagId(EXAMPLE_TAGS[tagIndex].name),
        text_entry_id: entryId(EXAMPLE_ENTRIES[entryIndex].subject),
        user_id: userId,
        order,
        date_created: timestamp,
        date_updated: timestamp,
      });
    }),
  ]);
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.username, username));
  return user as User;
}

/**
 * Django's User.save() for new users: if the username is taken, append
 * `-<random digits>`, growing the suffix until it is free.
 */
export async function createUser(
  db: Db,
  username: string,
  email: string
): Promise<User> {
  let candidate = username;
  for (let suffixLength = 1; suffixLength <= 20; suffixLength++) {
    const [taken] = await db
      .select({id: users.id})
      .from(users)
      .where(eq(users.username, candidate))
      .limit(1);
    if (taken === undefined) {
      try {
        return await insertUserWithDefaults(db, candidate, email);
      } catch (error) {
        if (!isUniqueViolation(error)) {
          throw error;
        }
      }
    }
    candidate = `${username}-${randomDigits(suffixLength)}`;
  }
  throw new Error(`Could not find a free username for ${username}`);
}

/** users.utils.create_collisionless_user: get_or_create keyed on email. */
export async function getOrCreateUser(
  db: Db,
  username: string,
  email: string
): Promise<{user: User; created: boolean}> {
  const [existing] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .orderBy(asc(users.id))
    .limit(1);
  if (existing !== undefined) {
    return {user: existing, created: false};
  }
  return {user: await createUser(db, username, email), created: true};
}

/** A returning user's login: bump last_login and login_count. */
export async function recordLogin(db: Db, userId: number): Promise<void> {
  await db
    .update(users)
    .set({last_login: now(), login_count: sql`${users.login_count} + 1`})
    .where(eq(users.id, userId));
}
