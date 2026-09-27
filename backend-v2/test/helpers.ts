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
import {tagOrdering} from '../src/resources/tags';
import {createUser} from '../src/services/users';

export const db = (): Db => createDb(env.DB);

let sequence = 0;
const next = () => sequence++;

// ---------------------------------------------------------------------------
// Factories
// ---------------------------------------------------------------------------

/** UserFactory: creation runs the same defaults as Django's post_save. */
export async function userFactory(
  overrides: {username?: string; email?: string} = {}
): Promise<User> {
  const n = next();
  return createUser(
    db(),
    overrides.username ?? `user-${n}`,
    overrides.email ?? `user-${n}@example.com`
  );
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
  const [entry] = await db()
    .insert(textEntries)
    .values({
      subject: fields.subject ?? `subject-${n}`,
      body: fields.body ?? `body-${n}`,
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
  let fired = false;
  const pattern = new RegExp(`^insert into "${table}"`, 'i');
  const wrap = (
    statement: D1PreparedStatement,
    query: string
  ): D1PreparedStatement =>
    new Proxy(statement, {
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
  const database = new Proxy(env.DB, {
    get(target, property) {
      if (property === 'prepare') {
        return (query: string) => wrap(target.prepare(query), query);
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
