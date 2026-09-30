/**
 * The writes (src/lib/data/writes.ts) against the mock API, which keeps
 * state as the API's database would: each stores what the API answered in
 * the signed-in user's IndexedDB database.
 */

import {EXPECTED_USER_HEADER} from '@commandsnippets/api-shared/messages';
import {act} from '@testing-library/react';
import {Dexie} from 'dexie';
import invariant from 'invariant';
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
import {entriesOfTag} from '../../../../src/lib/data/hooks';
import {
  createEntry,
  createTag,
  deleteEntry,
  deleteTag,
  ReadOnlyError,
  renameTag,
  reorderEntries,
  untagEntry,
} from '../../../../src/lib/data/writes';
import {syncSession} from '../../../../src/lib/sync/session';
import {putJunctions} from '../../../../src/lib/sync/store';
import {server} from '../../../util/msw';
import {signIn, store, TEST_USER} from '../../../util/signIn';

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  // The mock API announces each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  return () => vi.restoreAllMocks();
});

const session = () => syncSession(TEST_USER);

/** The ids of tag `tagId`'s entries the database holds. */
const inTag = async (tagId: string) =>
  (await entriesOfTag(session(), tagId)).map(({entry}) => entry.id).sort();

describe('the writes', () => {
  it('store the tags they create, rename and delete', async () => {
    const created = await createTag(session(), 'new-tag');
    expect(
      (await session().db.tags.get([TEST_USER, created.id]))?.attributes.name
    ).toBe('new-tag');

    await renameTag(session(), '2', 'renamed');
    expect(
      (await session().db.tags.get([TEST_USER, '2']))?.attributes.name
    ).toBe('renamed');

    await deleteTag(session(), '3');
    expect(
      (await session().db.tags.get([TEST_USER, '3']))?.attributes.is_deleted
    ).toBe(true);
  });

  it('store an entry created in a tag, with its junction', async () => {
    await session().sync.syncAll();
    const entry = await createEntry(session(), 'subject', 'body', '2');

    expect(await inTag('2')).toEqual([entry.id]);
    expect(
      (await session().db.entries.get([TEST_USER, entry.id]))?.attributes
        .subject
    ).toBe('subject');
  });

  it('take an entry out of a tag at once, and sync the tag', async () => {
    await session().sync.syncAll();
    expect(await inTag('1')).toEqual(['1', '2', '3', '4']);

    await untagEntry(session(), '1', '2');
    expect(await inTag('1')).toEqual(['1', '3', '4']);
    // The tag's sync stores the API's deleted junction, and it stays out.
    await vi.waitFor(async () =>
      expect(
        (await session().db.junctions.get([TEST_USER, '2']))?.attributes
          .date_updated
      ).not.toBe('2020-04-13T18:20:00')
    );
    expect(await inTag('1')).toEqual(['1', '3', '4']);
  });

  it('delete an entry at once, which a stale copy never brings back', async () => {
    await session().sync.syncAll();
    const stale = await session().db.entries.get([TEST_USER, '4']);

    await deleteEntry(session(), '4');
    expect(
      (await session().db.entries.get([TEST_USER, '4']))?.attributes.is_deleted
    ).toBe(true);
    // A page read before the delete, stored after it.
    if (stale !== undefined) {
      const {putEntries} = await import('../../../../src/lib/sync/store');
      await putEntries(session().db, TEST_USER, [stale]);
    }
    expect(
      (await session().db.entries.get([TEST_USER, '4']))?.attributes.is_deleted
    ).toBe(true);
  });

  it("are refused as another user's, storing nothing, and the tab leaves", async () => {
    // This tab signed in as alice; another has signed in as the mock API's
    // user since, and the cookie is theirs.
    act(() => store.setLoggedInUser('alice'));
    const alice = syncSession('alice');
    const requested: Array<string | null> = [];
    server.events.on('request:start', ({request}) => {
      requested.push(request.headers.get(EXPECTED_USER_HEADER));
    });

    await expect(createTag(alice, 'theirs')).rejects.toBeInstanceOf(
      UserMismatchError
    );

    expect(requested).toEqual(['alice']);
    // Signed out here, alice's database with it.
    await vi.waitFor(() => expect(store.loggedInUser).toBeNull());
    await vi.waitFor(async () =>
      expect(await Dexie.exists(alice.db.name)).toBe(false)
    );
    server.events.removeAllListeners();
  });

  it("are refused unsent in another user's (read-only) data", async () => {
    const theirs = syncSession(TEST_USER, 'alice');
    const requested: string[] = [];
    server.events.on('request:start', ({request}) => {
      requested.push(`${request.method} ${request.url}`);
    });

    for (const write of [
      () => createTag(theirs, 'mine now'),
      () => renameTag(theirs, '70', 'renamed'),
      () => deleteEntry(theirs, '71'),
      () => untagEntry(theirs, '70', '71'),
      () => reorderEntries(theirs, '70', '71', '72'),
    ]) {
      await expect(write()).rejects.toBeInstanceOf(ReadOnlyError);
    }
    server.events.removeAllListeners();

    expect(requested).toEqual([]);
    expect(store.loggedInUser).toBe(TEST_USER);
  });

  it('name the signed-in user, URI-encoded', async () => {
    const requested: Array<string | null> = [];
    server.events.on('request:start', ({request}) => {
      requested.push(request.headers.get(EXPECTED_USER_HEADER));
    });
    await createTag(session(), 'mine');
    act(() => store.setLoggedInUser('jörg'));
    await createTag(syncSession('jörg'), 'his').catch(() => undefined);
    server.events.removeAllListeners();

    expect(requested).toEqual([TEST_USER, encodeURIComponent('jörg')]);
  });

  it('leave a revision a sync stored while an untag ran', async () => {
    await session().sync.syncAll();
    vi.spyOn(session().sync, 'syncTag').mockResolvedValue();
    const held = await session().db.junctions.get([TEST_USER, '2']);
    invariant(held, 'entry 2 is in tag 1');
    // Tagged again elsewhere: a sync stores the newer revision meanwhile.
    const retagged = {
      ...held,
      attributes: {...held.attributes, date_updated: '2030-01-01T00:00:00'},
    };
    vi.spyOn(apiClient, 'untagEntry').mockImplementation(async () => {
      await putJunctions(session().db, TEST_USER, [retagged]);
    });

    await untagEntry(session(), '1', '2');
    expect(await session().db.junctions.get([TEST_USER, '2'])).toEqual(
      retagged
    );
    expect(await inTag('1')).toEqual(['1', '2', '3', '4']);
  });
});
