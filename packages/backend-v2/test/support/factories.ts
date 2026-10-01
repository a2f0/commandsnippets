/** Ports of the Django tests' factory_boy factories. */
import {
  entryReuses,
  type Tag,
  type TagTextEntry,
  type TextEntry,
  type TextEntryReused,
  tags,
  tagsEntries,
  textEntries,
  type User,
} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {OrderedModel} from '../../src/lib/ordered';
import {searchColumns} from '../../src/lib/search';
import {tagOrdering} from '../../src/resources/tags';
import {createUser} from '../../src/services/users';
import {db} from './db';

let sequence = 0;
const next = () => sequence++;

/**
 * UserFactory. New accounts start empty, but the tests ported from Django were
 * written against the example tags and entries its post_save signal gave every
 * user, so test users still get them (`seedExampleData`) unless `examples` is
 * false.
 */
export async function userFactory(
  overrides: {username?: string; email?: string} = {},
  {examples = true}: {examples?: boolean} = {}
): Promise<User> {
  const n = next();
  const user = await createUser(
    db(),
    overrides.username ?? `user-${n}`,
    overrides.email ?? `user-${n}@example.com`
  );
  if (examples) {
    await seedExampleData(user);
  }
  return user;
}

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

/**
 * The tags, entries and junctions Django's post_save signal created for each
 * new user. The junctions' insert triggers keep the counters and
 * date_last_used in step, as they did for the signal.
 */
async function seedExampleData(user: User): Promise<void> {
  const tagRows = [];
  for (const tag of EXAMPLE_TAGS) {
    const timestamp = now();
    const [row] = await db()
      .insert(tags)
      .values({
        ...tag,
        user_id: user.id,
        date_created: timestamp,
        date_updated: timestamp,
        date_last_used: timestamp,
      })
      .returning();
    tagRows.push(row as Tag);
  }
  const entryRows = [];
  for (const entry of EXAMPLE_ENTRIES) {
    const timestamp = now();
    const [row] = await db()
      .insert(textEntries)
      .values({
        ...entry,
        ...searchColumns(entry),
        user_id: user.id,
        date_created: timestamp,
        date_updated: timestamp,
      })
      .returning();
    entryRows.push(row as TextEntry);
  }
  for (const [tagIndex, entryIndex, order] of EXAMPLE_JUNCTIONS) {
    const timestamp = now();
    await db()
      .insert(tagsEntries)
      .values({
        tag_id: (tagRows[tagIndex] as Tag).id,
        text_entry_id: (entryRows[entryIndex] as TextEntry).id,
        user_id: user.id,
        order,
        date_created: timestamp,
        date_updated: timestamp,
      });
  }
}

export async function tagFactory(fields: {
  user: User;
  name?: string;
  order?: number;
  is_deleted?: boolean;
  client_id?: string;
}): Promise<Tag> {
  const timestamp = now();
  const [tag] = await db()
    .insert(tags)
    .values({
      name: fields.name ?? `tag-${next()}`,
      user_id: fields.user.id,
      order:
        fields.order ??
        (await new OrderedModel(db(), tagOrdering).nextOrder(fields.user.id)),
      is_deleted: fields.is_deleted ?? false,
      client_id: fields.client_id ?? null,
      date_created: timestamp,
      date_updated: timestamp,
      date_last_used: timestamp,
    })
    .returning();
  return tag as Tag;
}

export async function textEntryFactory(fields: {
  user: User;
  subject?: string;
  body?: string;
  is_deleted?: boolean;
}): Promise<TextEntry> {
  const n = next();
  const timestamp = now();
  const subject = fields.subject ?? `subject-${n}`;
  const body = fields.body ?? `body-${n}`;
  const [entry] = await db()
    .insert(textEntries)
    .values({
      subject,
      body,
      ...searchColumns({subject, body}),
      user_id: fields.user.id,
      is_deleted: fields.is_deleted ?? false,
      date_created: timestamp,
      date_updated: timestamp,
    })
    .returning();
  return entry as TextEntry;
}

export async function tagTextEntryFactory(fields: {
  tag: Tag;
  text_entry: TextEntry;
  user: User;
  order?: number;
  is_deleted?: boolean;
}): Promise<TagTextEntry> {
  const timestamp = now();
  const [junction] = await db()
    .insert(tagsEntries)
    .values({
      tag_id: fields.tag.id,
      text_entry_id: fields.text_entry.id,
      user_id: fields.user.id,
      order: fields.order ?? 0,
      is_deleted: fields.is_deleted ?? false,
      date_created: timestamp,
      date_updated: timestamp,
    })
    .returning();
  return junction as TagTextEntry;
}

export async function textEntryReusedFactory(fields: {
  text_entry: TextEntry;
  user: User;
}): Promise<TextEntryReused> {
  const [reuse] = await db()
    .insert(entryReuses)
    .values({
      text_entry_id: fields.text_entry.id,
      user_id: fields.user.id,
      date_created: now(),
    })
    .returning();
  return reuse as TextEntryReused;
}
