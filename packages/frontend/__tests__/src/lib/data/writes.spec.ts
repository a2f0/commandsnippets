/**
 * The writes (src/lib/data/writes.ts), local first, and their queue
 * (src/lib/sync/outbox.ts) against the mock API, which keeps state as the
 * API's database would: each write is stored at once and queued, and a flush
 * sends the queue in order, storing what the API answered.
 */

import {CURSOR_START} from '@commandsnippets/api-shared/cursor';
import {formatMicros} from '@commandsnippets/api-shared/datetime';
import {
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
  CODES,
  EXPECTED_USER_HEADER,
} from '@commandsnippets/api-shared/messages';
import {act} from '@testing-library/react';
import {Dexie} from 'dexie';
import invariant from 'invariant';
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
import {apiClient, UserMismatchError} from '../../../../src/lib/api/apiClient';
import {setSignedInUser} from '../../../../src/lib/auth/authUtils';
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
import {isLocalId, LAST_MADE_KEY} from '../../../../src/lib/sync/outbox';
import {syncSession} from '../../../../src/lib/sync/session';
import {errorDocument} from '../../../../src/msw/documents';
import {apiClientMethods} from '../../../util/apiClientMethods';
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

  it('names when it was made, the signed-in user, and itself on every attempt', async () => {
    await session().sync.syncAll();
    const headers: Array<Array<string | null>> = [];
    server.events.on('request:start', ({request}) => {
      if (request.method !== 'GET') {
        headers.push([
          request.headers.get(CLIENT_UPDATED_HEADER),
          request.headers.get(EXPECTED_USER_HEADER),
          request.headers.get(CLIENT_WRITE_ID_HEADER),
        ]);
      }
    });
    offline();
    await renameTag(session(), '2', 'renamed');
    await renameTag(session(), '3', 'renamed-too');
    const [first, second] = await db().outbox.toArray();
    invariant(first && second, 'both writes should be queued');
    await expect(session().sync.flush()).rejects.toThrow();
    server.resetHandlers();

    await session().sync.flush();

    // When it was made (not when it was sent), by whom, and which write:
    // the same id on the failed attempt and the retry, another's apart.
    const attempts = headers.filter(([, , id]) => id === first.writeId);
    expect(attempts.length).toBeGreaterThan(1);
    for (const attempt of attempts) {
      expect(attempt).toEqual([first.made, TEST_USER, first.writeId]);
    }
    expect(headers.at(-1)).toEqual([second.made, TEST_USER, second.writeId]);
    expect(
      headers.every(([, , id]) => id === first.writeId || id === second.writeId)
    ).toBe(true);
    expect(first.writeId).not.toBe(second.writeId);
    expect(first.made).toMatch(/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{6}$/);
    expect(await queued()).toBe(0);
  });

  it('is made after every write made before it here, though the clock is set back', async () => {
    await session().sync.syncAll();
    offline();
    const now = Date.now();
    const clock = vi.spyOn(Date, 'now').mockReturnValue(now + 60_000);
    await renameTag(session(), '2', 'first');
    // The clock is set back a minute.
    clock.mockReturnValue(now);
    await renameTag(session(), '2', 'second');
    // Another tab (or this page before a reload) made one later still.
    const later = formatMicros((now + 120_000) * 1000);
    localStorage.setItem(LAST_MADE_KEY, String((now + 120_000) * 1000));
    await renameTag(session(), '2', 'third');

    const [first, second, third] = (await db().outbox.toArray()).map(
      row => row.made
    );
    invariant(first && second && third, 'the three writes should be queued');
    expect(second > first).toBe(true);
    expect(third > later).toBe(true);
    localStorage.removeItem(LAST_MADE_KEY);
  });

  it('sends its local id with a create, so a retry makes the entry once', async () => {
    const create = vi.spyOn(apiClientMethods, 'createEntry');

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

describe('a remap', () => {
  it('reaches the other tabs, and theirs this one', async () => {
    const otherTab = new BroadcastChannel('commandsnippets-remaps');
    const heard: unknown[] = [];
    otherTab.onmessage = ({data}) => heard.push(data);

    const tag = await createTag(session(), 'shared');
    await session().sync.flush();
    await vi.waitFor(() => expect(heard).toHaveLength(1));
    expect(heard[0]).toMatchObject({
      owner: TEST_USER,
      type: 'Tag',
      from: tag.id,
    });

    // Another tab's remap moves this tab's selection.
    act(() => store.setTagSelectedID('local-elsewhere'));
    otherTab.postMessage({
      owner: TEST_USER,
      type: 'Tag',
      from: 'local-elsewhere',
      to: '42',
    });
    await vi.waitFor(() => expect(store.tagSelectedID).toBe('42'));
    otherTab.close();
  });
});

describe('a write naming a local id', () => {
  it("reaches the row once the API's id has replaced it (an editor opened before)", async () => {
    const entry = await createEntry(session(), 'first', 'body');
    await session().sync.flush();
    expect(await entryRow(entry.id)).toBeUndefined();
    const writes = sent();

    // Saved from an editor that still holds the local id.
    const edited = await updateEntry(session(), entry.id, 'second', 'body');
    await session().sync.flush();

    expect(edited?.attributes.subject).toBe('second');
    expect(isLocalId(edited?.id ?? 'local-')).toBe(false);
    expect(writes).toEqual([`PATCH /api/v1/entries/${edited?.id}`]);
  });

  it("names the queue's owner, whoever this tab is signed in as when it is sent", async () => {
    const named: Array<string | null> = [];
    server.events.on('request:start', ({request}) => {
      if (request.method !== 'GET') {
        named.push(request.headers.get(EXPECTED_USER_HEADER));
      }
    });
    offline();
    await createTag(session(), 'mine');
    await expect(session().sync.flush()).rejects.toThrow();
    server.resetHandlers();

    // The tab reads another sign-in by the time the write is sent.
    setSignedInUser(() => 'someone-else');
    try {
      await session().sync.flush();
    } finally {
      setSignedInUser(() => store.loggedInUser);
    }

    expect(named.at(-1)).toBe(TEST_USER);
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

  it('keep a tag asked for again by id, never making another of the name', async () => {
    await session().sync.syncAll();
    const before = await inTag('1');
    offline();
    await createTag(session(), 'test-tag-1');
    await expect(session().sync.flush()).rejects.toThrow();
    server.resetHandlers();
    // Renamed on the API (another device) after it was asked for here.
    await apiClient.updateTag('1', 'renamed-elsewhere');

    await session().sync.flush();

    // The rename is newer: it stands. No tag of the old name is made.
    expect(await inTag('1')).toEqual(before);
    expect((await tagRow('1'))?.attributes.name).toBe('renamed-elsewhere');
    const named = await db()
      .tags.where('owner')
      .equals(TEST_USER)
      .filter(tag => tag.attributes.name === 'test-tag-1')
      .count();
    expect(named).toBe(0);
    expect(await queued()).toBe(0);
  });

  it('send a create of a tag the user has, and a tagging of an entry tagged already', async () => {
    await session().sync.syncAll();
    const writes = sent();

    expect((await createTag(session(), 'test-tag-1')).id).toBe('1');
    await tagEntry(session(), '1', '1');
    await session().sync.flush();

    // Nothing changes, but the API records when each was asked for.
    expect(writes).toEqual([
      'PATCH /api/v1/tags/1',
      'POST /api/v1/tags_entries',
    ]);
  });

  it('show a tagging whose answer was lost once, when a sync brings its junction', async () => {
    await session().sync.syncAll();
    // The API tags the entry, but its answer never arrives.
    server.use(
      http.post(
        `${API}/tags_entries`,
        async ({request}) => {
          await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: await request.text(),
          });
          return HttpResponse.error();
        },
        {once: true}
      )
    );
    const local = await tagEntry(session(), '2', '3');
    await expect(session().sync.flush()).rejects.toThrow();

    await session().sync.syncAll();
    await session().sync.syncTag('2');
    const pair = async () =>
      (await db().junctions.where('owner').equals(TEST_USER).toArray()).filter(
        junction =>
          junction.relationships.tag.data.id === '2' &&
          junction.relationships.text_entry.data.id === '3'
      );
    // The API's junction, in place of the local one: shown once.
    expect(await inTag('2')).toEqual(['3']);
    const [junction] = await pair();
    expect(await pair()).toHaveLength(1);
    expect(junction?.localId).toBe(local.id);
    expect(isLocalId(junction?.id ?? 'local-')).toBe(false);
    // Still queued (the API records when it was made), now naming it.
    expect((await db().outbox.toArray()).map(row => row.write)).toEqual([
      expect.objectContaining({kind: 'tagEntry', junctionId: junction?.id}),
    ]);

    await session().sync.flush();
    expect(await queued()).toBe(0);
    expect(await pair()).toHaveLength(1);
    expect(await inTag('2')).toEqual(['3']);
  });

  it("show an entry made offline in a tag once, when a sync brings it and another device's tagging of it", async () => {
    await session().sync.syncAll();
    // The API makes the entry, but its answer never arrives.
    server.use(
      http.post(
        `${API}/entries`,
        async ({request}) => {
          await fetch(request.url, {
            method: 'POST',
            headers: request.headers,
            body: await request.text(),
          });
          return HttpResponse.error();
        },
        {once: true}
      )
    );
    const local = await createEntry(session(), 'both', 'body', '2');
    await expect(session().sync.flush()).rejects.toThrow();
    // Another device puts the API's entry in the same tag.
    const listed = await apiClient.getEntriesAfter(CURSOR_START);
    const made = listed.data.find(
      entry => entry.attributes.client_id === local.id
    );
    invariant(made, 'the API should have made the entry');
    await apiClient.tagEntry('2', made.id);

    await session().sync.syncAll();
    const pair = (
      await db().junctions.where('owner').equals(TEST_USER).toArray()
    ).filter(
      junction =>
        junction.relationships.tag.data.id === '2' &&
        junction.relationships.text_entry.data.id === made.id
    );
    expect(pair).toHaveLength(1);
    expect((await inTag('2')).filter(id => id === made.id)).toHaveLength(1);
    // The create is adopted; the tagging stays queued, naming the API's ids.
    expect((await db().outbox.toArray()).map(row => row.write)).toEqual([
      expect.objectContaining({
        kind: 'tagEntry',
        junctionId: pair[0]?.id,
        entryId: made.id,
      }),
    ]);
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

  it('count a tagging and an untagging at once, as the API does', async () => {
    await session().sync.syncAll();
    const counts = async () => {
      const tag = await tagRow('2');
      const entry = await entryRow('1');
      invariant(tag && entry, 'tag 2 and entry 1 should be stored');
      return {
        tag: tag.attributes.entry_count,
        entry: entry.attributes.tag_count,
      };
    };
    const before = await counts();
    offline();

    await tagEntry(session(), '2', '1');
    const tagged = {tag: before.tag + 1, entry: before.entry + 1};
    expect(await counts()).toEqual(tagged);
    // Tagged already: no count changes.
    await tagEntry(session(), '2', '1');
    expect(await counts()).toEqual(tagged);
    const made = await createEntry(session(), 'counted', 'body', '2');
    expect((await entryRow(made.id))?.attributes.tag_count).toBe(1);
    expect((await tagRow('2'))?.attributes.entry_count).toBe(before.tag + 2);
    await untagEntry(session(), '2', made.id);
    await untagEntry(session(), '2', '1');
    expect(await counts()).toEqual(before);

    // The API counts alike.
    server.resetHandlers();
    await session().sync.flush();
    expect(await counts()).toEqual(before);
  });

  it('keep the counts of a tagging not sent yet through a sync', async () => {
    await session().sync.syncAll();
    const tag = async () => {
      const row = await tagRow('2');
      invariant(row, 'tag 2 should be stored');
      return row.attributes;
    };
    const before = (await tag()).entry_count;
    // Another device renames the tag.
    await apiClient.updateTag('2', 'renamed-elsewhere');
    offline();
    await tagEntry(session(), '2', '1');

    // Reads still reach the API: the tag it reads is counted without the
    // tagging, and is left as it is until the tagging is sent.
    await session().sync.syncAll();
    expect((await tag()).entry_count).toBe(before + 1);

    // Its answer brings the tag as the API holds it then.
    server.resetHandlers();
    await session().sync.flush();
    expect(await tag()).toMatchObject({
      name: 'renamed-elsewhere',
      entry_count: before + 1,
    });
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
    // At once, with the API's ranks (the tags shifted too), before a sync.
    expect(await ranked()).toEqual(moved);
    const orders = (await db().tags.toArray()).map(tag => tag.attributes.order);
    expect(new Set(orders).size).toBe(orders.length);
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
    // At once, with the API's ranks, before a sync.
    expect(await ranked()).toEqual(moved);
    const orders = (await entriesOfTag(session(), '1')).map(
      ({junction}) => junction.attributes.order
    );
    expect(new Set(orders).size).toBe(orders.length);
    await session().sync.syncTag('1');
    expect(await ranked()).toEqual(moved);
  });

  it('store a moved tag as the API holds it once sent, though a sync left it as it was', async () => {
    await session().sync.syncAll();
    // Another device renames the tag, which this one moves meanwhile.
    await apiClient.updateTag('3', 'renamed-elsewhere');
    offline();
    await reorderTags(session(), '3', '1');
    await session().sync.syncAll();
    expect((await tagRow('3'))?.attributes.name).toBe('test-tag-3');

    server.resetHandlers();
    await session().sync.flush();
    // Read again, without another sync: the reorder answers nothing.
    const {data: held} = await apiClient.getTag('3');
    expect((await tagRow('3'))?.attributes).toEqual(held.attributes);
    expect(held.attributes.name).toBe('renamed-elsewhere');
  });

  it('store a moved junction as the API holds it once sent', async () => {
    await session().sync.syncAll();
    const [first, , third] = (await entriesOfTag(session(), '1'))
      .sort((a, b) => a.junction.attributes.order - b.junction.attributes.order)
      .map(({entry}) => entry.id);
    invariant(first && third, 'tag 1 should hold three entries');
    offline();
    await reorderEntries(session(), '1', third, first);
    await session().sync.syncAll();

    server.resetHandlers();
    await session().sync.flush();
    const {
      data: [held],
    } = await apiClient.getJunction('1', third);
    invariant(held, 'the API should hold the junction');
    expect((await junctionRow(held.id))?.attributes).toEqual(held.attributes);
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

  it('send a reorder once, retrying only the read of its rows when that fails', async () => {
    await session().sync.syncAll();
    const firstOf = async () =>
      (await entriesOfTag(session(), '1')).sort(
        (a, b) => a.junction.attributes.order - b.junction.attributes.order
      )[0]?.entry.id;
    const lastOf = async () =>
      (await entriesOfTag(session(), '1')).sort(
        (a, b) => b.junction.attributes.order - a.junction.attributes.order
      )[0]?.entry.id;
    const [top, bottom] = [await lastOf(), await firstOf()];
    invariant(top && bottom, 'tag 1 should hold entries');
    offline();
    await reorderTags(session(), '4', '2');
    await reorderEntries(session(), '1', top, bottom);
    await expect(session().sync.flush()).rejects.toThrow();
    server.resetHandlers();
    // The reorders reach the API; the reads of their rows fail, once each.
    server.use(
      http.get(`${API}/tags`, () => HttpResponse.error(), {once: true}),
      http.get(`${API}/tags_entries`, () => HttpResponse.error(), {
        once: true,
      })
    );
    const writes = sent();

    await expect(session().sync.flush()).rejects.toThrow();
    expect((await db().outbox.toArray()).map(row => row.write)).toEqual([
      {kind: 'refreshTags'},
      expect.objectContaining({kind: 'reorderEntries'}),
    ]);
    await expect(session().sync.flush()).rejects.toThrow();
    expect((await db().outbox.toArray()).map(row => row.write)).toEqual([
      {kind: 'refreshJunctions', tagId: '1'},
    ]);
    await session().sync.flush();

    // Each reorder sent once, its rows read again.
    expect(writes).toEqual([
      'POST /api/v1/tags/reorder',
      'POST /api/v1/tags_entries/reorder',
    ]);
    expect(await queued()).toBe(0);
    expect(await firstOf()).toBe(top);
  });

  it("store no other user's rows that the queue reads after an account switch", async () => {
    await session().sync.syncAll();
    const listed = await apiClient.getTagsAfter(CURSOR_START);
    const [first] = listed.data;
    invariant(first, 'the API should list a tag');
    offline();
    await reorderTags(session(), '4', '2');
    // The reorder reaches the API; then another tab signs in as someone
    // else, whose cookie it is: a read naming this tab's user is refused, as
    // the API refuses it, and one naming none answers with their tags.
    server.resetHandlers();
    const named: Array<string | null> = [];
    server.use(
      http.get(`${API}/tags`, ({request}) => {
        named.push(request.headers.get(EXPECTED_USER_HEADER));
        return request.headers.get(EXPECTED_USER_HEADER) === null
          ? HttpResponse.json({
              ...listed,
              data: [
                {
                  ...first,
                  id: '99',
                  attributes: {...first.attributes, name: 'theirs'},
                  relationships: {user: {data: {type: 'User', id: '2'}}},
                },
              ],
            })
          : HttpResponse.json(
              errorDocument(409, CODES.userMismatch, 'Another user.'),
              {status: 409}
            );
      })
    );

    await expect(session().sync.flush()).rejects.toThrow(UserMismatchError);
    expect(named).toEqual([TEST_USER]);
    expect(await tagRow('99')).toBeUndefined();
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

    // Signed out here; alice's queued write stays, for her next sign-in.
    await vi.waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(named).toEqual(['alice']);
    expect(await Dexie.exists(alice.db.name)).toBe(true);
    expect(await syncSession('alice').db.outbox.count()).toBe(1);
  });
});
