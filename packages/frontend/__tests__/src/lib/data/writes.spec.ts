/**
 * The writes (src/lib/data/writes.ts), local first, and their queue
 * (src/lib/sync/outbox.ts) against the mock API, which keeps state as the
 * API's database would: each write is stored at once and queued, and a flush
 * sends the queue in order, storing what the API answered.
 */

import {
  CLIENT_UPDATED_HEADER,
  CODES,
  EXPECTED_USER_HEADER,
} from '@commandsnippets/api-shared/messages';
import {act} from '@testing-library/react';
import {Dexie} from 'dexie';
import {delay, HttpResponse, http} from 'msw';
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
import {apiClient} from '../../../../src/lib/api/apiClient';
import {entriesOfTag} from '../../../../src/lib/data/hooks';
import {
  createEntry,
  createTag,
  deleteEntry,
  deleteTag,
  InvalidWriteError,
  ReadOnlyError,
  renameTag,
  reorderEntries,
  reorderTags,
  tagEntry,
  untagEntry,
  updateEntry,
} from '../../../../src/lib/data/writes';
import {isLocalId} from '../../../../src/lib/sync/outbox';
import {syncSession} from '../../../../src/lib/sync/session';
import {errorDocument} from '../../../../src/msw/documents';
import {server} from '../../../util/msw';
import {signIn, store, TEST_USER} from '../../../util/signIn';

const API = 'http://localhost:9001/api/v1';

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  // The mock API announces each request; a flush that fails warns.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

const session = () => syncSession(TEST_USER);
const db = () => session().db;
const queued = () => db().outbox.count();
const tagRow = (id: string) => db().tags.get([TEST_USER, id]);
const entryRow = (id: string) => db().entries.get([TEST_USER, id]);
const junctionRow = (id: string) => db().junctions.get([TEST_USER, id]);

/** The ids of tag `tagId`'s entries the database holds. */
const inTag = async (tagId: string) =>
  (await entriesOfTag(session(), tagId)).map(({entry}) => entry.id).sort();

/** The writes sent from now on, as `METHOD path`. */
function sent(): string[] {
  const writes: string[] = [];
  server.events.on('request:start', ({request}) => {
    if (request.method !== 'GET') {
      writes.push(`${request.method} ${new URL(request.url).pathname}`);
    }
  });
  return writes;
}

/** The API unreachable (offline) for writes until the handlers reset. */
const offline = () =>
  server.use(
    http.all(`${API}/*`, ({request}) =>
      request.method === 'GET' ? undefined : HttpResponse.error()
    )
  );

describe('a write', () => {
  it('is stored and queued at once, before the API answers', async () => {
    server.use(
      http.post(`${API}/tags`, async () => {
        await delay('infinite');
      })
    );

    const tag = await createTag(session(), ' new-tag ');

    expect(isLocalId(tag.id)).toBe(true);
    expect((await tagRow(tag.id))?.attributes.name).toBe('new-tag');
    expect(await queued()).toBe(1);
  });

  it('reaches the API in order, and the rows get the API ids', async () => {
    await session().sync.syncAll();
    const writes = sent();

    const tag = await createTag(session(), 'mine');
    const entry = await createEntry(session(), 'subject', 'body', tag.id);
    await session().sync.flush();

    expect(writes).toEqual([
      'POST /api/v1/tags',
      'POST /api/v1/entries',
      'POST /api/v1/tags_entries',
    ]);
    expect(await queued()).toBe(0);
    // The local rows are gone; the API's hold the same data, linked.
    expect(await tagRow(tag.id)).toBeUndefined();
    expect(await entryRow(entry.id)).toBeUndefined();
    const stored = await db()
      .tags.where('owner')
      .equals(TEST_USER)
      .filter(row => row.attributes.name === 'mine')
      .first();
    expect(isLocalId(stored?.id ?? 'local-')).toBe(false);
    const listed = await entriesOfTag(session(), stored?.id ?? '');
    expect(listed.map(({entry: row}) => row.attributes.subject)).toEqual([
      'subject',
    ]);
    expect(isLocalId(listed[0]?.entry.id ?? 'local-')).toBe(false);
    expect(isLocalId(listed[0]?.junction.id ?? 'local-')).toBe(false);
  });

  it('follows its row to the API id in the selection', async () => {
    const tag = await createTag(session(), 'selected');
    act(() => store.setTagSelectedID(tag.id));

    await session().sync.flush();

    expect(isLocalId(store.tagSelectedID)).toBe(false);
    expect((await tagRow(store.tagSelectedID))?.attributes.name).toBe(
      'selected'
    );
  });

  it('names when it was made, and the signed-in user', async () => {
    await session().sync.syncAll();
    const headers: Array<[string | null, string | null]> = [];
    server.events.on('request:start', ({request}) => {
      if (request.method !== 'GET') {
        headers.push([
          request.headers.get(CLIENT_UPDATED_HEADER),
          request.headers.get(EXPECTED_USER_HEADER),
        ]);
      }
    });
    offline();
    await renameTag(session(), '2', 'renamed');
    const {made} = (await db().outbox.toArray())[0] ?? {made: ''};
    server.resetHandlers();

    await session().sync.flush();

    // When it was made (not when it was sent), and by whom.
    expect(headers.at(-1)).toEqual([made, TEST_USER]);
    expect(made).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}$/);
    expect(await queued()).toBe(0);
  });

  it('sends its local id with a create, so a retry makes the entry once', async () => {
    const create = vi.spyOn(apiClient, 'createEntry');

    const entry = await createEntry(session(), 'once', 'body');
    await session().sync.flush();

    expect(create).toHaveBeenCalledWith(
      'once',
      'body',
      entry.id,
      expect.any(String)
    );
  });
});

describe('offline', () => {
  it('keeps every write, and sends them all once back online', async () => {
    await session().sync.syncAll();
    offline();

    const tag = await createTag(session(), 'offline');
    await renameTag(session(), '2', 'renamed offline');
    await deleteEntry(session(), '4');
    await untagEntry(session(), '1', '2');
    await expect(session().sync.flush()).rejects.toThrow();

    // All of it shows, and all of it waits.
    expect((await tagRow(tag.id))?.attributes.name).toBe('offline');
    expect((await tagRow('2'))?.attributes.name).toBe('renamed offline');
    expect((await entryRow('4'))?.attributes.is_deleted).toBe(true);
    expect(await inTag('1')).toEqual(['1', '3']);
    expect(await queued()).toBe(4);

    server.resetHandlers();
    await session().sync.flush();
    expect(await queued()).toBe(0);
    await session().sync.syncAll();
    expect((await tagRow('2'))?.attributes.name).toBe('renamed offline');
    expect((await entryRow('4'))?.attributes.is_deleted).toBe(true);
    expect(await inTag('1')).toEqual(['1', '3']);
  });

  it('is never undone by a sync before the write is sent', async () => {
    await session().sync.syncAll();
    offline();
    await renameTag(session(), '2', 'mine');
    await untagEntry(session(), '1', '3');

    // The sync reads the API's (older) copies of both.
    await db().cursors.clear();
    await session().sync.syncAll();

    expect((await tagRow('2'))?.attributes.name).toBe('mine');
    expect(await inTag('1')).not.toContain('3');
  });
});

describe('a write the API fails', () => {
  it('stays queued, in order, after a 5xx, and goes on the next flush', async () => {
    await session().sync.syncAll();
    server.use(
      http.patch(`${API}/tags/:id`, () =>
        HttpResponse.json({errors: []}, {status: 503})
      )
    );
    await renameTag(session(), '2', 'later');
    await deleteTag(session(), '3');
    await expect(session().sync.flush()).rejects.toThrow('Service Unavailable');
    expect(await queued()).toBe(2);

    server.resetHandlers();
    await session().sync.flush();
    expect(await queued()).toBe(0);
    expect((await tagRow('2'))?.attributes.name).toBe('later');
    expect((await tagRow('3'))?.attributes.is_deleted).toBe(true);
  });
});

describe('a write a newer one beat (last writer wins)', () => {
  it('keeps the row as the API answers it', async () => {
    await session().sync.syncAll();
    // Another device renamed it later than this write was made: the API
    // changes nothing, and answers with the tag as it stands.
    server.use(
      http.patch(`${API}/tags/:id`, async () => {
        const {data} = await apiClient.getTag('2');
        return HttpResponse.json({
          data: {...data, attributes: {...data.attributes, name: 'newer'}},
        });
      })
    );

    await renameTag(session(), '2', 'older');
    await session().sync.flush();

    expect((await tagRow('2'))?.attributes.name).toBe('newer');
  });

  it('a create of a tag another device made is that tag', async () => {
    await session().sync.syncAll();
    offline();
    // Made here offline...
    const local = await createTag(session(), 'elsewhere');
    const entry = await createEntry(session(), 'in it', 'body', local.id);
    await expect(session().sync.flush()).rejects.toThrow();
    server.resetHandlers();
    // ...and on the API by another device, which a sync brings meanwhile.
    const {data: theirs} = await apiClient.createTag('elsewhere');
    await session().sync.syncAll();
    const named = async () =>
      (await db().tags.where('owner').equals(TEST_USER).toArray()).filter(
        tag => tag.attributes.name === 'elsewhere'
      );
    expect(await named()).toHaveLength(2);

    await session().sync.flush();

    // One tag of the name, the API's, with the entry in it.
    expect((await named()).map(tag => tag.id)).toEqual([theirs.id]);
    const stored = await db()
      .entries.where('owner')
      .equals(TEST_USER)
      .filter(row => row.attributes.subject === 'in it')
      .first();
    expect(isLocalId(entry.id)).toBe(true);
    expect(await inTag(theirs.id)).toEqual([stored?.id]);
  });
});

describe('a write the API would refuse', () => {
  it('is never made: nothing stored or queued, and the editor keeps it', async () => {
    await session().sync.syncAll();
    const writes = sent();
    const entries = await db().entries.count();

    await expect(
      createEntry(session(), 'subject', 'x'.repeat(1025))
    ).rejects.toBeInstanceOf(InvalidWriteError);
    await expect(
      updateEntry(session(), '1', '', 'body')
    ).rejects.toBeInstanceOf(InvalidWriteError);
    await expect(createTag(session(), '   ')).rejects.toBeInstanceOf(
      InvalidWriteError
    );
    // A user's tags have unique names, deleted ones' included.
    await deleteTag(session(), '3');
    await expect(
      renameTag(session(), '2', 'test-tag-3')
    ).rejects.toBeInstanceOf(InvalidWriteError);
    await session().sync.flush();

    expect(await db().entries.count()).toBe(entries);
    expect((await entryRow('1'))?.attributes.subject).not.toBe('');
    expect((await tagRow('2'))?.attributes.name).toBe('test-tag-2');
    expect(writes).toEqual(['DELETE /api/v1/tags/3']);
  });
});

describe('a write the API refuses', () => {
  it('is dropped, and its row put back as the API holds it', async () => {
    await session().sync.syncAll();
    const name = (await tagRow('2'))?.attributes.name;
    server.use(
      http.patch(`${API}/tags/:id`, () =>
        HttpResponse.json(
          errorDocument(
            400,
            CODES.unique,
            'The fields name, user must make a unique set.'
          ),
          {status: 400}
        )
      )
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await renameTag(session(), '2', 'taken');
    expect((await tagRow('2'))?.attributes.name).toBe('taken');
    await session().sync.flush();

    expect(await queued()).toBe(0);
    expect((await tagRow('2'))?.attributes.name).toBe(name);
  });

  it('has its row put back once the API can be reached', async () => {
    await session().sync.syncAll();
    server.use(
      http.patch(`${API}/tags/:id`, () =>
        HttpResponse.json(errorDocument(400, CODES.invalid, 'No.'), {
          status: 400,
        })
      ),
      http.get(`${API}/tags/:id`, () => HttpResponse.error())
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});

    await renameTag(session(), '2', 'refused');
    await expect(session().sync.flush()).rejects.toThrow();
    // The refused write is gone; putting its row back waits in the queue.
    expect((await db().outbox.toArray()).map(row => row.write.kind)).toEqual([
      'restoreTag',
    ]);
    // A sync does not bring the row back (the API never changed it).
    await session().sync.syncAll();
    expect((await tagRow('2'))?.attributes.name).toBe('refused');

    server.resetHandlers();
    await session().sync.flush();
    expect(await queued()).toBe(0);
    expect((await tagRow('2'))?.attributes.name).toBe('test-tag-2');
  });

  it('takes the writes that needed the row it would have made with it', async () => {
    await session().sync.syncAll();
    server.use(
      http.post(`${API}/entries`, () =>
        HttpResponse.json(errorDocument(400, CODES.invalid, 'No.'), {
          status: 400,
        })
      )
    );
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const writes = sent();

    const entry = await createEntry(session(), 'refused', 'body', '1');
    await session().sync.flush();

    expect(writes).toEqual(['POST /api/v1/entries']);
    expect(await queued()).toBe(0);
    expect(await entryRow(entry.id)).toBeUndefined();
    expect(await inTag('1')).not.toContain(entry.id);
  });
});

describe('the writes', () => {
  it('rename and delete tags; creating a name the user has is that tag', async () => {
    await session().sync.syncAll();

    await renameTag(session(), '2', 'renamed');
    await deleteTag(session(), '3');
    const named = await createTag(session(), 'renamed');
    expect(named.id).toBe('2');
    await session().sync.flush();

    expect((await tagRow('2'))?.attributes.name).toBe('renamed');
    expect((await tagRow('3'))?.attributes.is_deleted).toBe(true);
  });

  it('tag an entry at the bottom of a tag, and untag it', async () => {
    await session().sync.syncAll();

    const junction = await tagEntry(session(), '2', '1');
    expect(await inTag('2')).toContain('1');
    await session().sync.flush();
    expect(await inTag('2')).toContain('1');
    expect(await junctionRow(junction.id)).toBeUndefined();

    await untagEntry(session(), '2', '1');
    expect(await inTag('2')).not.toContain('1');
    await session().sync.flush();
    expect(await inTag('2')).not.toContain('1');
  });

  it('move a tag directly above another at once, and the API ranks it so', async () => {
    await session().sync.syncAll();
    const ranked = async () =>
      (await db().tags.where('owner').equals(TEST_USER).toArray())
        .filter(tag => !tag.attributes.is_deleted)
        .sort((a, b) => a.attributes.order - b.attributes.order)
        .map(tag => tag.id);
    const [first, second, third, fourth] = await ranked();

    await reorderTags(session(), fourth ?? '', second ?? '');
    const moved = [first, fourth, second, third];
    expect(await ranked()).toEqual(moved);
    await session().sync.flush();
    await session().sync.syncAll();
    expect(await ranked()).toEqual(moved);
  });

  it('move an entry directly above another in a tag', async () => {
    await session().sync.syncAll();
    const ranked = async () =>
      (await entriesOfTag(session(), '1'))
        .sort(
          (a, b) => a.junction.attributes.order - b.junction.attributes.order
        )
        .map(({entry}) => entry.id);
    const [first, , third] = await ranked();

    await reorderEntries(session(), '1', third ?? '', first ?? '');
    const moved = await ranked();
    expect(moved.slice(0, 2)).toEqual([third, first]);
    await session().sync.flush();
    await session().sync.syncTag('1');
    expect(await ranked()).toEqual(moved);
  });

  it("are refused unsent in another user's (read-only) data", async () => {
    const theirs = syncSession(TEST_USER, 'alice');
    const writes = sent();

    for (const write of [
      () => createTag(theirs, 'mine now'),
      () => renameTag(theirs, '70', 'renamed'),
      () => deleteEntry(theirs, '71'),
      () => untagEntry(theirs, '70', '71'),
      () => reorderEntries(theirs, '70', '71', '72'),
    ]) {
      await expect(write()).rejects.toBeInstanceOf(ReadOnlyError);
    }
    await theirs.sync.flush();

    expect(writes).toEqual([]);
    expect(await theirs.db.outbox.count()).toBe(0);
    expect(store.loggedInUser).toBe(TEST_USER);
  });

  it("are sent as the signed-in user's; refused as another's, the tab leaves", async () => {
    // This tab signed in as alice; another has signed in as the mock API's
    // user since, and the cookie is theirs.
    act(() => store.setLoggedInUser('alice'));
    const alice = syncSession('alice');
    const named: Array<string | null> = [];
    server.events.on('request:start', ({request}) => {
      named.push(request.headers.get(EXPECTED_USER_HEADER));
    });

    await createTag(alice, 'theirs');

    // Signed out here, alice's database (and its queue) with it.
    await vi.waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(named).toEqual(['alice']);
    await vi.waitFor(async () =>
      expect(await Dexie.exists(alice.db.name)).toBe(false)
    );
  });
});
