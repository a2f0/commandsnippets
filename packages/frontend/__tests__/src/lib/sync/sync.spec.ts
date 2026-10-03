/**
 * The sync (src/lib/sync/) against the E2E handlers' mock API, which keeps
 * state as backend-v2's database does, into a fake IndexedDB.
 */
import {
  CURSOR_START,
  type TagTextEntryCreateDocument,
  tagCursorListDocumentSchema,
  tagTextEntryCursorListDocumentSchema,
  tagTextEntryListDocumentSchema,
  textEntryCursorListDocumentSchema,
  userDocumentSchema,
} from '@commandsnippets/api-shared';
import {setupServer} from 'msw/node';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import {adminSyncApi} from '../../../../src/lib/api/adminApi';
import {
  CommandsnippetsDatabase,
  type RowKey,
  tagCursorKey,
} from '../../../../src/lib/db/database';
import {ownSyncApi} from '../../../../src/lib/sync/session';
import {ForeignDataError} from '../../../../src/lib/sync/store';
import {
  createSyncEngine as createEngine,
  isTagSynced,
  type SyncApi,
  SyncUserError,
} from '../../../../src/lib/sync/sync';
import {onePage} from '../../../../src/msw/documents';
import {
  handlers,
  resetMSWState,
  setRuntimeEntriesOverride,
} from '../../../../src/msw/handlers';
import {entry} from '../../../util/storeFixtures';

const API = 'http://localhost:9001/api/v1';
const JSON_API = {'Content-Type': 'application/vnd.api+json'};

const server = setupServer(...handlers);

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());

let db: CommandsnippetsDatabase;
let databases = 0;
beforeEach(() => {
  resetMSWState();
  // The handlers announce each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  databases += 1;
  db = new CommandsnippetsDatabase(`sync-spec-${databases}`);
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.delete();
});

const read = async (path: string) => (await fetch(`${API}${path}`)).json();
const after = (value: string) => encodeURIComponent(value);

/** The mock API's signed-in user, whose data the syncs read. */
const OWNER = 'test';
const key = (id: string): RowKey => [OWNER, id];
const own = <R>(rows: R[]) => rows.map(row => ({...row, owner: OWNER}));

/** The mock API's signed-in user's sync of `db`. */
const createSyncEngine = (
  database: CommandsnippetsDatabase,
  api: SyncApi,
  lockName: string
) => createEngine(database, api, lockName, OWNER);

/** The sync's reads, `size` rows a page (the app reads 100). */
function pagedApi(size: number, pages: string[] = []): SyncApi {
  const page = (path: string) => {
    pages.push(path);
    return read(`${path}&page[size]=${size}`);
  };
  return {
    getEntryCount: () => ownSyncApi.getEntryCount(),
    getOwner: async () => {
      const {data} = userDocumentSchema.parse(await read('/user/'));
      return {id: data.id, username: data.attributes.username};
    },
    getTagsAfter: async cursor =>
      tagCursorListDocumentSchema.parse(
        await page(`/tags?page[after]=${after(cursor)}`)
      ),
    getEntriesAfter: async cursor =>
      textEntryCursorListDocumentSchema.parse(
        await page(
          `/entries?page[after]=${after(cursor)}&include=text_entry_to_tag`
        )
      ),
    getTagJunctionsAfter: async (tagId, cursor) =>
      tagTextEntryCursorListDocumentSchema.parse(
        await page(
          `/tags_entries?filter[tag.id]=${tagId}&page[after]=${after(cursor)}&include=text_entry,text_entry.text_entry_to_tag`
        )
      ),
    getNewestJunction: async () =>
      tagTextEntryListDocumentSchema.parse(
        await read('/tags_entries?sort=-date_updated&page[size]=1')
      ),
  };
}

async function send(
  method: 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown
) {
  const response = await fetch(`${API}${path}`, {
    method,
    ...(body === undefined
      ? {}
      : {body: JSON.stringify(body), headers: JSON_API}),
  });
  expect(response.ok).toBe(true);
}

const tagEntry = (
  tagId: string,
  entryId: string
): TagTextEntryCreateDocument => ({
  data: {
    type: 'TagTextEntryThroughModel',
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
    },
  },
});

const ids = (rows: ReadonlyArray<{id: string}>) =>
  rows.map(({id}) => id).sort();
const activeJunctions = async () =>
  ids(
    (await db.junctions.toArray()).filter(
      junction => !junction.attributes.is_deleted
    )
  );

describe('syncAll', () => {
  it('loads 205 entries in 100-row pages and saves first-load progress', async () => {
    const entries = Array.from({length: 205}, (_, index) =>
      entry(String(index + 1), {})
    );
    setRuntimeEntriesOverride({
      ...onePage(`${API}/entries`, entries.length),
      data: entries,
    });
    const count = vi.fn(ownSyncApi.getEntryCount);
    const progress: Array<unknown> = [];
    const sync = createSyncEngine(
      db,
      {
        ...ownSyncApi,
        getEntryCount: count,
        getEntriesAfter: async after => {
          progress.push((await db.cursors.get(key('entries')))?.initialLoad);
          return ownSyncApi.getEntriesAfter(after);
        },
      },
      'spec'
    );
    await sync.syncAll();

    expect(await db.entries.count()).toBe(205);
    expect(progress).toEqual([
      {pages: 0, totalPages: 3, complete: false},
      {pages: 1, totalPages: 3, complete: false},
      {pages: 2, totalPages: 3, complete: false},
    ]);
    expect((await db.cursors.get(key('entries')))?.initialLoad).toEqual({
      pages: 3,
      totalPages: 3,
      complete: true,
    });
    await sync.syncAll();
    expect(count).toHaveBeenCalledTimes(1);
  });

  it('keeps page progress across an interruption and a new engine', async () => {
    const api = pagedApi(1);
    let reads = 0;
    const failing: SyncApi = {
      ...api,
      getEntriesAfter: async after => {
        if (++reads === 2) {
          throw new Error('offline');
        }
        return api.getEntriesAfter(after);
      },
    };
    await expect(
      createSyncEngine(db, failing, 'spec').syncAll()
    ).rejects.toThrow('offline');
    expect((await db.cursors.get(key('entries')))?.initialLoad).toEqual({
      pages: 1,
      totalPages: 2,
      complete: false,
    });
    await createSyncEngine(db, api, 'spec').syncAll();
    expect(await db.entries.count()).toBe(3);
    expect((await db.cursors.get(key('entries')))?.initialLoad).toEqual({
      pages: 3,
      totalPages: 3,
      complete: true,
    });
  });

  it('still reads all pages when counting fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    await createSyncEngine(
      db,
      {
        ...pagedApi(1),
        getEntryCount: async () => {
          throw new Error('count unavailable');
        },
      },
      'spec'
    ).syncAll();
    expect(await db.entries.count()).toBe(3);
    expect((await db.cursors.get(key('entries')))?.initialLoad).toEqual({
      pages: 3,
      totalPages: 3,
      complete: true,
    });
  });

  it('completes an empty collection without inventing a loaded page', async () => {
    setRuntimeEntriesOverride({...onePage(`${API}/entries`, 0), data: []});
    await createSyncEngine(db, ownSyncApi, 'spec').syncAll();
    expect((await db.cursors.get(key('entries')))?.initialLoad).toEqual({
      pages: 0,
      totalPages: 0,
      complete: true,
    });
  });

  it('reads the whole collection on the first sync', async () => {
    await createSyncEngine(db, ownSyncApi, 'spec').syncAll();

    expect(ids(await db.tags.toArray())).toEqual(['1', '2', '3', '4']);
    expect(ids(await db.entries.toArray())).toEqual(['1', '2', '3']);
    expect(await activeJunctions()).toEqual(['1', '2']);
    // A master cursor each, and a cursor for every tag at its revision.
    expect(await db.cursors.get(key('tags'))).toBeDefined();
    expect(await db.cursors.get(key('entries'))).toBeDefined();
    for (const tagId of ['1', '2', '3', '4']) {
      expect(await isTagSynced(db, OWNER, tagId)).toBe(true);
    }
  });

  it('reads only what changed since, from where it stopped', async () => {
    const pages: string[] = [];
    const sync = createSyncEngine(db, pagedApi(2, pages), 'spec');
    await sync.syncAll();
    const firstRead = pages.length;
    pages.length = 0;

    await sync.syncAll();
    // One page each, after the cursors: nothing changed.
    expect(pages).toHaveLength(2);
    expect(pages.every(page => !page.includes(after(CURSOR_START)))).toBe(true);
    expect(firstRead).toBeGreaterThan(2);
  });

  it('stores edits, deletions and untagging', async () => {
    const sync = createSyncEngine(db, pagedApi(2), 'spec');
    await sync.syncAll();

    await send('PATCH', '/entries/1', {
      data: {type: 'TextEntry', id: '1', attributes: {body: 'edited'}},
    });
    await send('DELETE', '/entries/2');
    await send('DELETE', '/tags/4');
    await send('DELETE', '/tags_entries/1');
    await sync.syncAll();

    expect((await db.entries.get(key('1')))?.attributes.body).toBe('edited');
    expect((await db.entries.get(key('2')))?.attributes.is_deleted).toBe(true);
    expect((await db.tags.get(key('4')))?.attributes.is_deleted).toBe(true);
    // Entry 1's listing leaves junction 1 out: it is deleted here too.
    expect(await activeJunctions()).toEqual(['2']);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      true
    );
  });

  it('gives no tag its cursor until the entries are all read', async () => {
    const api = pagedApi(1);
    let entriesPages = 0;
    const failing: SyncApi = {
      ...api,
      getEntriesAfter: async cursor => {
        entriesPages += 1;
        if (entriesPages === 2) {
          throw new Error('offline');
        }
        return api.getEntriesAfter(cursor);
      },
    };
    await expect(
      createSyncEngine(db, failing, 'spec').syncAll()
    ).rejects.toThrow('offline');
    // A page of entries is stored, with its cursor; no tag claims a sync.
    expect(await db.entries.count()).toBe(1);
    expect(await db.cursors.get(key('entries'))).toBeDefined();
    expect(
      await db.cursors.filter(({key}) => key.startsWith('tag:')).count()
    ).toBe(0);

    // The next sync goes on from the cursor, to the end.
    const pages: string[] = [];
    await createSyncEngine(db, pagedApi(1, pages), 'spec').syncAll();
    // The two entries after the first page's (a page each).
    expect(pages.filter(page => page.startsWith('/entries'))).toHaveLength(2);
    for (const tagId of ['1', '2', '3', '4']) {
      expect(await isTagSynced(db, OWNER, tagId)).toBe(true);
    }
  });

  it('lets a tag sync asked for meanwhile run between two pages', async () => {
    const api = pagedApi(1);
    const reads: string[] = [];
    let sync: ReturnType<typeof createSyncEngine> | undefined;
    let tagSync: Promise<void> | undefined;
    sync = createSyncEngine(
      db,
      {
        ...api,
        getEntriesAfter: async cursor => {
          reads.push('entries');
          // The tag shown, asked for during the first page.
          tagSync ??= sync?.syncTag('1');
          return api.getEntriesAfter(cursor);
        },
        getTagJunctionsAfter: async (tagId, cursor) => {
          reads.push(`tag ${tagId}`);
          return api.getTagJunctionsAfter(tagId, cursor);
        },
      },
      'spec'
    );
    await sync.syncAll();
    await tagSync;
    // Tag 1's two junctions (a page each), after the entries' first page.
    expect(reads).toEqual(['entries', 'tag 1', 'tag 1', 'entries', 'entries']);
    expect(await isTagSynced(db, OWNER, '1')).toBe(true);
  });

  it("refuses to sync another user's data into the database", async () => {
    const api = pagedApi(2);
    const bob: SyncApi = {
      ...api,
      getOwner: async () => ({id: '2', username: 'bob'}),
    };
    await expect(createSyncEngine(db, bob, 'spec').syncAll()).rejects.toThrow(
      SyncUserError
    );
    await expect(
      createSyncEngine(db, bob, 'spec').syncTag('1')
    ).rejects.toThrow(SyncUserError);
    expect(await db.tags.count()).toBe(0);

    // A page with another user's row is not stored, and its cursor stays.
    const foreign: SyncApi = {
      ...api,
      getTagsAfter: async cursor => {
        const page = await api.getTagsAfter(cursor);
        return {
          ...page,
          data: page.data.map(tag => ({
            ...tag,
            relationships: {user: {data: {type: 'User', id: '2'}}},
          })),
        };
      },
    };
    await expect(
      createSyncEngine(db, foreign, 'spec').syncAll()
    ).rejects.toThrow(ForeignDataError);
    expect(await db.tags.count()).toBe(0);
    expect(await db.cursors.get(key('tags'))).toBeUndefined();
  });

  it('keeps a newer revision stored than the one it reads', async () => {
    const sync = createSyncEngine(db, pagedApi(2), 'spec');
    await sync.syncAll();
    const entry = await db.entries.get(key('1'));
    expect(entry).toBeDefined();
    if (entry !== undefined) {
      // As the app's own write would store it.
      await db.entries.put({
        ...entry,
        attributes: {
          ...entry.attributes,
          body: 'mine',
          date_updated: '2099-01-01T00:00:00',
        },
      });
    }
    await db.cursors.delete(key('entries'));
    await sync.syncAll();
    expect((await db.entries.get(key('1')))?.attributes.body).toBe('mine');
  });

  it('runs one sync at a time', async () => {
    let running = 0;
    let most = 0;
    const api = pagedApi(1);
    const slow =
      <A extends unknown[], R>(read: (...args: A) => Promise<R>) =>
      async (...args: A) => {
        running += 1;
        most = Math.max(most, running);
        await new Promise(resolve => setTimeout(resolve, 5));
        running -= 1;
        return read(...args);
      };
    const sync = createSyncEngine(
      db,
      {
        getEntryCount: slow(api.getEntryCount),
        getOwner: slow(api.getOwner),
        getTagsAfter: slow(api.getTagsAfter),
        getEntriesAfter: slow(api.getEntriesAfter),
        getTagJunctionsAfter: slow(api.getTagJunctionsAfter),
        getNewestJunction: slow(api.getNewestJunction),
      },
      'spec'
    );
    await Promise.all([sync.syncAll(), sync.syncTag('1'), sync.syncAll()]);
    expect(most).toBe(1);
  });
});

describe("another user's data (staff reading it)", () => {
  it("syncs beside the owner's own, keyed by theirs", async () => {
    await createSyncEngine(db, pagedApi(2), 'spec').syncAll();
    const own = await db.tags.where('owner').equals(OWNER).count();

    const alice = createEngine(
      db,
      adminSyncApi('alice'),
      'spec:alice',
      'alice'
    );
    await alice.syncAll();
    await alice.syncTag('70');

    expect(await db.tags.where('owner').equals(OWNER).count()).toBe(own);
    expect((await db.tags.get(['alice', '70']))?.attributes.name).toBe(
      'alices-tag'
    );
    expect((await db.entries.get(['alice', '71']))?.attributes.subject).toBe(
      'alices-entry'
    );
    expect(await db.junctions.get(['alice', '700'])).toBeDefined();
    expect(await isTagSynced(db, 'alice', '70')).toBe(true);
    expect(await isTagSynced(db, OWNER, '70')).toBe(false);
  });

  it('refuses a user the admin API does not find', async () => {
    const nobody = createEngine(
      db,
      adminSyncApi('nobody'),
      'spec:nobody',
      'nobody'
    );
    await expect(nobody.syncAll()).rejects.toThrow('No user named nobody.');
    expect(await db.tags.count()).toBe(0);
  });
});

describe('syncTag', () => {
  it("reads one tag's changes: joins, departures and edits", async () => {
    const pages: string[] = [];
    const sync = createSyncEngine(db, pagedApi(2, pages), 'spec');
    await sync.syncAll();

    await send('POST', '/tags_entries', tagEntry('2', '1'));
    await send('DELETE', '/tags_entries/2');
    await send('PATCH', '/entries/1', {
      data: {type: 'TextEntry', id: '1', attributes: {subject: 'renamed'}},
    });
    pages.length = 0;
    await sync.syncTag('1');

    // Only tag 1's junctions were read.
    expect(pages.every(page => page.includes('filter[tag.id]=1'))).toBe(true);
    expect((await db.junctions.get(key('2')))?.attributes.is_deleted).toBe(
      true
    );
    expect((await db.entries.get(key('1')))?.attributes.subject).toBe(
      'renamed'
    );
    // Entry 1's new junction (to tag 2) came with it.
    const tagged = (await db.junctions.toArray()).filter(
      junction =>
        junction.relationships.tag.data.id === '2' &&
        !junction.attributes.is_deleted
    );
    expect(
      tagged.map(junction => junction.relationships.text_entry.data.id)
    ).toEqual(['1']);
  });

  it('reads a tag whole before the collection is', async () => {
    const api = pagedApi(2);
    const sync = createSyncEngine(db, api, 'spec');
    // The tags only, as the first sync's first pages store them.
    const tags = await api.getTagsAfter(CURSOR_START);
    await db.tags.bulkPut(own(tags.data));

    await sync.syncTag('1');
    expect(await activeJunctions()).toEqual(['1', '2']);
    expect(ids(await db.entries.toArray())).toEqual(['1', '2']);
    expect(await isTagSynced(db, OWNER, '1')).toBe(true);
    expect(await isTagSynced(db, OWNER, '2')).toBe(false);
  });

  it('is out of sync once the tag reaches a newer revision', async () => {
    const api = pagedApi(2);
    const sync = createSyncEngine(db, api, 'spec');
    await sync.syncAll();
    await send('DELETE', '/tags_entries/1');
    // A read of the tags stores tag 1's new revision.
    const tags = await pagedApi(100).getTagsAfter(CURSOR_START);
    await db.tags.bulkPut(own(tags.data));
    expect(await isTagSynced(db, OWNER, '1')).toBe(false);
    expect(await isTagSynced(db, OWNER, '2')).toBe(true);

    await sync.syncTag('1');
    expect(await isTagSynced(db, OWNER, '1')).toBe(true);
    expect((await db.junctions.get(key('1')))?.attributes.is_deleted).toBe(
      true
    );
    expect((await db.cursors.get(key(tagCursorKey('1'))))?.revision).toBe(
      (await db.tags.get(key('1')))?.attributes.date_updated
    );
  });
});
