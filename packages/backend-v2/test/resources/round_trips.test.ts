/**
 * How requests read D1: what they batch into one round trip, and what they
 * leave unread. The documents themselves are the other suites' to check.
 */
import {env} from 'cloudflare:workers';
import {and, eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  entryReuses,
  type TagTextEntry,
  tags,
  tagsEntries,
  textEntries,
  type User,
  users,
} from '../../src/db/schema';
import {
  ApiClient,
  clientFor,
  db,
  json,
  reorderDocument,
  richUserFactory,
  staffFactory,
  taggingDocument,
  tokenFor,
} from '../helpers';
import {raceBeforeStatement} from '../support/races';

/** One call to D1: its statements (several for a batch), as SQL. */
interface Call {
  queries: string[];
  /** Whether another call was still in flight when it began. */
  overlapped: boolean;
}

/** Bindings whose D1 records every call made through them. */
function recorded(): {bindings: Cloudflare.Env; calls: Call[]} {
  const calls: Call[] = [];
  let inFlight = 0;
  const record = async <T>(queries: string[], run: () => Promise<T>) => {
    calls.push({queries, overlapped: inFlight > 0});
    inFlight += 1;
    try {
      return await run();
    } finally {
      inFlight -= 1;
    }
  };
  // D1's batch() needs the native statements back.
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
        if (['run', 'all', 'raw', 'first'].includes(String(property))) {
          return (...args: unknown[]) =>
            record([query], async () =>
              (value as (...a: unknown[]) => unknown).apply(target, args)
            );
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
        return (statements: D1PreparedStatement[]) => {
          const unwrapped = statements.map(
            statement => natives.get(statement) ?? {statement, query: ''}
          );
          return record(
            unwrapped.map(({query}) => query),
            () => target.batch(unwrapped.map(({statement}) => statement))
          );
        };
      }
      const value = Reflect.get(target, property);
      return typeof value === 'function' ? value.bind(target) : value;
    },
  });
  return {
    bindings: new Proxy(env, {
      get: (target, property) =>
        property === 'DB' ? database : Reflect.get(target, property),
    }),
    calls,
  };
}

const queries = (calls: Call[]) => calls.flatMap(call => call.queries);

/** The call whose statements match every pattern, if one does. */
const callWith = (calls: Call[], ...patterns: RegExp[]) =>
  calls.find(call =>
    patterns.every(pattern => call.queries.some(query => pattern.test(query)))
  );

const INVALID_PAGE = {
  errors: [
    {
      detail: 'Invalid page.',
      status: '404',
      source: {pointer: '/data'},
      code: 'not_found',
    },
  ],
};

let owner: User;
let token: string;

beforeEach(async () => {
  owner = await richUserFactory();
  token = await tokenFor(owner.id);
});

describe('a numbered page', () => {
  it('reads its count and its rows in one round trip', async () => {
    for (const [path, table] of [
      ['/api/v1/entries', 'text_entries_textentry'],
      ['/api/v1/tags?page[size]=1&page[number]=2', 'tags_tag'],
      ['/api/v1/tags_entries', 'tags_tagtextentrythroughmodel'],
    ] as const) {
      const {bindings, calls} = recorded();
      const response = await new ApiClient(token, bindings).get(path);
      expect(response.status).toBe(200);
      const call = callWith(
        calls,
        new RegExp(`^select count\\(\\*\\) from "${table}"`),
        new RegExp(
          `^select "id", .* from "${table}" .*limit \\?( offset \\?)?$`
        )
      );
      expect(call?.queries).toHaveLength(2);
    }
  });

  it('is a 404 past the end, however far past', async () => {
    const client = new ApiClient(token);
    for (const page of ['9', '99999999999999999999', '9'.repeat(400)]) {
      for (const path of ['/api/v1/entries', '/api/v1/tags']) {
        const response = await client.get(`${path}?page[number]=${page}`);
        expect(response.status).toBe(404);
        expect(await json(response)).toEqual(INVALID_PAGE);
      }
    }
  });
});

describe('the user a resource belongs to', () => {
  it('is rendered from the row the request read, not read again', async () => {
    const {bindings, calls} = recorded();
    const client = new ApiClient(token, bindings);
    for (const path of [
      '/api/v1/tags',
      '/api/v1/entries',
      '/api/v1/tags_entries',
    ]) {
      const response = await client.get(path);
      expect(response.status).toBe(200);
      const user = (await json(response)).included.find(
        (resource: {type: string}) => resource.type === 'User'
      );
      expect(user).toEqual({
        type: 'User',
        id: String(owner.id),
        attributes: {
          username: owner.username,
          is_staff: false,
          date_updated: expect.any(String),
          data_version: 1,
        },
      });
    }
    // Only authentication's UPDATE ... RETURNING touches users_user.
    expect(
      queries(calls).filter(query =>
        /^select .* from "users_user"/i.test(query)
      )
    ).toEqual([]);
  });
});

describe('entries read to be rendered', () => {
  it('leave their search folds unread', async () => {
    const {bindings, calls} = recorded();
    const client = new ApiClient(token, bindings);
    const guest = new ApiClient(undefined, bindings);
    for (const response of [
      await client.get('/api/v1/entries'),
      await client.get('/api/v1/tags_entries?include=text_entry'),
      await client.get('/api/v1/user/backup'),
      await guest.get(`/api/v1/users/${owner.username}/entries`),
      await guest.get(`/api/v1/users/${owner.username}/tags_entries`),
    ]) {
      expect(response.status).toBe(200);
    }
    expect(queries(calls).filter(query => query.includes('_folded'))).toEqual(
      []
    );
  });

  it('are still searched by their folds', async () => {
    const {bindings, calls} = recorded();
    const response = await new ApiClient(token, bindings).get(
      '/api/v1/entries?filter[search]=GIT'
    );
    expect((await json(response)).data.map(({id}: {id: string}) => id)).toEqual(
      [
        String(
          (
            await db()
              .select({id: textEntries.id})
              .from(textEntries)
              .where(eq(textEntries.subject, 'log'))
          )[0]?.id
        ),
      ]
    );
    const entryQueries = queries(calls).filter(query =>
      query.includes('from "text_entries_textentry"')
    );
    expect(entryQueries.length).toBeGreaterThan(0);
    for (const query of entryQueries) {
      const [selected = '', condition = ''] = query.split(
        ' from "text_entries_textentry"'
      );
      expect(selected).not.toContain('_folded');
      expect(condition).toContain('_folded');
    }
  });
});

describe('pks a write names', () => {
  it('are looked up in one round trip', async () => {
    const [tag] = await db()
      .insert(tags)
      .values({
        name: 'new',
        user_id: owner.id,
        order: 9,
        date_created: '2024-01-01T00:00:00.000000',
        date_updated: '2024-01-01T00:00:00.000000',
      })
      .returning();
    const [entry] = await db()
      .select()
      .from(textEntries)
      .where(eq(textEntries.subject, 'alone'));
    const {bindings, calls} = recorded();
    const response = await new ApiClient(token, bindings).post(
      '/api/v1/tags_entries',
      taggingDocument(tag?.id, entry?.id)
    );
    expect(response.status).toBe(201);
    expect(
      callWith(
        calls,
        /^select "id" from "tags_tag" where/,
        /^select "id" from "text_entries_textentry" where/
      )?.queries
    ).toHaveLength(2);
  });

  it('are each reported missing, in field order', async () => {
    const {bindings, calls} = recorded();
    const client = new ApiClient(token, bindings);
    const tagging = await client.post(
      '/api/v1/tags_entries',
      taggingDocument('99999', 'x')
    );
    const tagLookups = calls.length;
    const reorder = await client.post(
      '/api/v1/tags/reorder',
      reorderDocument('Tag', 99999, 99998)
    );

    expect(tagging.status).toBe(400);
    expect(await json(tagging)).toEqual({
      errors: [
        {
          detail: 'Invalid pk "99999" - object does not exist.',
          status: '400',
          source: {pointer: '/data/relationships/tag'},
          code: 'does_not_exist',
        },
        {
          detail: 'Invalid pk "x" - object does not exist.',
          status: '400',
          source: {pointer: '/data/relationships/text_entry'},
          code: 'does_not_exist',
        },
      ],
    });
    expect(reorder.status).toBe(400);
    expect(await json(reorder)).toEqual({
      errors: [
        {
          detail: 'Invalid pk "99999" - object does not exist.',
          status: '400',
          source: {pointer: '/data/attributes/top'},
          code: 'does_not_exist',
        },
        {
          detail: 'Invalid pk "99998" - object does not exist.',
          status: '400',
          source: {pointer: '/data/attributes/bottom'},
          code: 'does_not_exist',
        },
      ],
    });
    // The reorder's two lookups went in one batch.
    expect(
      calls
        .slice(tagLookups)
        .filter(call =>
          call.queries.some(query => /from "tags_tag" where/.test(query))
        )
        .map(call => call.queries.length)
    ).toEqual([2]);
  });

  it('move a tag (whose scope is its user) as before', async () => {
    const ranked = await db()
      .select({id: tags.id})
      .from(tags)
      .where(eq(tags.user_id, owner.id))
      .orderBy(tags.order);
    const [first, second] = ranked;
    const response = await new ApiClient(token).post(
      '/api/v1/tags/reorder',
      reorderDocument('Tag', second?.id, first?.id)
    );
    expect(response.status).toBe(200);
    expect(
      (
        await db()
          .select({id: tags.id})
          .from(tags)
          .where(eq(tags.user_id, owner.id))
          .orderBy(tags.order)
      ).map(({id}) => id)
    ).toEqual([second?.id, first?.id]);
  });
});

describe('include paths of one length', () => {
  it('load at once', async () => {
    const {bindings, calls} = recorded();
    const response = await new ApiClient(token, bindings).get(
      '/api/v1/tags_entries'
    );
    expect(response.status).toBe(200);
    const tagLoad = callWith(calls, /^select .* from "tags_tag" where/);
    const entryLoad = callWith(
      calls,
      /^select .* from "text_entries_textentry" where/
    );
    expect(tagLoad).toBeDefined();
    expect(entryLoad).toBeDefined();
    expect([tagLoad?.overlapped, entryLoad?.overlapped]).toContain(true);
  });
});

describe('data versions', () => {
  it('are listed with the active one as of one moment', async () => {
    const client = new ApiClient(token);
    const backup = await json(await client.get('/api/v1/user/backup'));
    // A restore (a new version, made active) lands just before the active
    // version is read: it must be in the list it labels.
    const raced = new ApiClient(
      token,
      raceBeforeStatement(/^select "active_version" from "users_user"/i, () =>
        client.post('/api/v1/user/restore', backup)
      )
    );

    const response = await raced.get('/api/v1/user/data_versions');

    expect(response.status).toBe(200);
    expect(
      (await json(response)).data.map(
        ({id, attributes}: {id: string; attributes: {active: boolean}}) => [
          id,
          attributes.active,
        ]
      )
    ).toEqual([
      ['2', true],
      ['1', false],
    ]);
  });

  it('refuse to delete the active one, which keeps every row', async () => {
    const count = async () => {
      const of = (
        table:
          | typeof tags
          | typeof textEntries
          | typeof tagsEntries
          | typeof entryReuses
      ) =>
        db()
          .select({id: table.id})
          .from(table)
          .where(and(eq(table.user_id, owner.id), eq(table.version, 1)));
      return [
        (await of(tags)).length,
        (await of(textEntries)).length,
        (await of(tagsEntries)).length,
        (await of(entryReuses)).length,
      ];
    };
    const before = await count();
    const junctions: TagTextEntry[] = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.user_id, owner.id));

    const response = await new ApiClient(token).delete(
      '/api/v1/user/data_versions/1'
    );

    expect(response.status).toBe(400);
    expect(await json(response)).toEqual({
      errors: [
        {
          detail: 'The active data version cannot be deleted.',
          status: '400',
          source: {pointer: '/data'},
          code: 'invalid',
        },
      ],
    });
    expect(before).toEqual([2, 3, 3, 3]);
    expect(await count()).toEqual(before);
    expect(
      await db()
        .select()
        .from(tagsEntries)
        .where(eq(tagsEntries.user_id, owner.id))
    ).toEqual(junctions);
    expect(
      (
        await db()
          .select({active: users.active_version})
          .from(users)
          .where(eq(users.id, owner.id))
      )[0]?.active
    ).toBe(1);
  });
});

describe("a staff read of a user's data", () => {
  it('reads the account without its counts', async () => {
    const staff = await staffFactory();
    const {bindings, calls} = recorded();
    const reader = await clientFor(staff, bindings);
    const response = await reader.get(
      `/api/v1/admin/users/${owner.id}/entries`
    );
    expect(response.status).toBe(200);
    // The admin user list's counts are of the account's active version.
    expect(
      queries(calls).filter(query =>
        query.includes('users_user.active_version')
      )
    ).toEqual([]);
  });
});
