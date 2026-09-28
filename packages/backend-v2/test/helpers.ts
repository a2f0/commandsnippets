/**
 * Ports of the Django test scaffolding: BaseTestCase (tearleads/core/tests),
 * the factory_boy factories, and a small APIClient with a cookie jar.
 */
import {env} from 'cloudflare:workers';
import {eq} from 'drizzle-orm';
import {app} from '../src/app';
import {createDb, type Db} from '../src/db/client';
import {
  entryReuses,
  type Tag,
  type TagTextEntry,
  type TextEntry,
  type TextEntryReused,
  tags,
  tagsEntries,
  textEntries,
  tokens,
  type User,
  users,
} from '../src/db/schema';
import {now} from '../src/lib/clock';
import {OrderedModel} from '../src/lib/ordered';
import {searchColumns} from '../src/lib/search';
import {tagOrdering} from '../src/resources/tags';
import {createUser} from '../src/services/users';

export const db = (): Db => createDb(env.DB);

let sequence = 0;
const next = () => sequence++;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

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
export async function seedExampleData(user: User): Promise<void> {
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
}): Promise<TagTextEntry> {
  const timestamp = now();
  const [junction] = await db()
    .insert(tagsEntries)
    .values({
      tag_id: fields.tag.id,
      text_entry_id: fields.text_entry.id,
      user_id: fields.user.id,
      order: fields.order ?? 0,
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

// ---------------------------------------------------------------------------
// Model helpers (refresh_from_db and friends)
// ---------------------------------------------------------------------------

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
export {isoformat} from '../src/lib/clock';

// ---------------------------------------------------------------------------
// APIClient
// ---------------------------------------------------------------------------

export interface Cookie {
  value: string;
  attributes: Record<string, string | true>;
}

function parseSetCookie(header: string): [string, Cookie] {
  const [pair = '', ...parts] = header.split(';').map(part => part.trim());
  const separator = pair.indexOf('=');
  const name = pair.slice(0, separator);
  const attributes: Record<string, string | true> = {};
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index === -1) {
      attributes[part.toLowerCase()] = true;
    } else {
      attributes[part.slice(0, index).toLowerCase()] = part.slice(index + 1);
    }
  }
  return [
    name,
    {value: decodeURIComponent(pair.slice(separator + 1)), attributes},
  ];
}

export class ApiClient {
  readonly cookies = new Map<string, Cookie>();

  constructor(
    token?: string,
    private readonly bindings: Cloudflare.Env = env
  ) {
    if (token !== undefined) {
      this.cookies.set('Authorization', {value: token, attributes: {}});
    }
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const cookie = [...this.cookies]
      .filter(([, {value}]) => value !== '')
      .map(([name, {value}]) => `${name}=${value}`)
      .join('; ');
    const response = await app.request(
      `http://localhost${path}`,
      {
        method,
        headers: {
          'Content-Type': 'application/vnd.api+json',
          ...(cookie === '' ? {} : {Cookie: cookie}),
          ...headers,
        },
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      },
      this.bindings
    );
    for (const header of response.headers.getSetCookie()) {
      const [name, parsed] = parseSetCookie(header);
      this.cookies.set(name, parsed);
    }
    return response;
  }

  get(path: string, headers?: Record<string, string>) {
    return this.request('GET', path, undefined, headers);
  }
  post(path: string, body?: unknown) {
    return this.request('POST', path, body ?? {});
  }
  patch(path: string, body: unknown) {
    return this.request('PATCH', path, body);
  }
  put(path: string, body: unknown) {
    return this.request('PUT', path, body);
  }
  delete(path: string) {
    return this.request('DELETE', path);
  }
  options(path: string, headers: Record<string, string>) {
    return this.request('OPTIONS', path, undefined, headers);
  }
}

/**
 * Bindings whose D1 runs `competitor` immediately before the first statement
 * inserting into `table` executes: the narrowest race window left once a
 * create computes its rank inside the INSERT itself.
 */
export function raceBeforeInsert(
  table: string,
  competitor: () => Promise<unknown>
): Cloudflare.Env {
  return raceBeforeStatement(
    new RegExp(`^\\s*insert into "${table}"`, 'i'),
    competitor
  );
}

/**
 * Bindings whose D1 runs `competitor` immediately before the first statement
 * matching `pattern` executes.
 */
export function raceBeforeStatement(
  pattern: RegExp,
  competitor: () => Promise<unknown>
): Cloudflare.Env {
  let fired = false;
  // D1's batch() needs the native statements back, and their query text.
  const natives = new WeakMap<
    object,
    {statement: D1PreparedStatement; query: string}
  >();
  const wrap = (
    statement: D1PreparedStatement,
    query: string
  ): D1PreparedStatement => {
    const proxy = new Proxy(statement, {
      get(target, property) {
        const value = Reflect.get(target, property);
        if (property === 'bind') {
          return (...args: unknown[]) => wrap(target.bind(...args), query);
        }
        if (
          ['run', 'all', 'raw', 'first'].includes(String(property)) &&
          !fired &&
          pattern.test(query)
        ) {
          return async (...args: unknown[]) => {
            fired = true;
            await competitor();
            return (value as (...a: unknown[]) => unknown).apply(target, args);
          };
        }
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    natives.set(proxy, {statement, query});
    return proxy;
  };
  const database = new Proxy(env.DB, {
    get(target, property) {
      if (property === 'prepare') {
        return (query: string) => wrap(target.prepare(query), query);
      }
      if (property === 'batch') {
        return async (statements: D1PreparedStatement[]) => {
          const unwrapped = statements.map(
            statement => natives.get(statement) ?? {statement, query: ''}
          );
          if (!fired && unwrapped.some(({query}) => pattern.test(query))) {
            fired = true;
            await competitor();
          }
          return target.batch(unwrapped.map(({statement}) => statement));
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return new Proxy(env, {
    get: (target, property) =>
      property === 'DB' ? database : Reflect.get(target, property),
  });
}

// ---------------------------------------------------------------------------
// BaseTestCase
// ---------------------------------------------------------------------------

export interface Base {
  user1: User;
  user2: User;
  user1Client: ApiClient;
  unauthenticatedUser: User;
  unauthenticatedClient: ApiClient;
}

export async function setUpBase(): Promise<Base> {
  const user1 = await userFactory();
  const user2 = await userFactory();
  const unauthenticatedUser = await userFactory();
  return {
    user1,
    user2,
    user1Client: new ApiClient(await tokenFor(user1.id)),
    unauthenticatedUser,
    unauthenticatedClient: new ApiClient(),
  };
}

// biome-ignore lint/suspicious/noExplicitAny: JSON:API documents in tests.
export type Json = any;

export async function json(response: Response): Promise<Json> {
  return response.json();
}
