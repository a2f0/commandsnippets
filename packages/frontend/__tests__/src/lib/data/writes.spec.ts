/**
 * The writes (src/lib/data/writes.ts) against the mock API, which keeps
 * state as the API's database would: each stores what the API answered in
 * the signed-in user's IndexedDB database.
 */
import {
  afterAll,
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
  renameTag,
  tagEntry,
  untagEntry,
} from '../../../../src/lib/data/writes';
import {syncSession} from '../../../../src/lib/sync/session';
import {ForeignDataError} from '../../../../src/lib/sync/store';
import {server} from '../../../util/msw';
import {signIn, TEST_USER} from '../../../util/signIn';

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
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
  (await entriesOfTag(session().db, tagId)).map(({entry}) => entry.id).sort();

describe('the writes', () => {
  it('store the tags they create, rename and delete', async () => {
    const created = await createTag(session(), 'new-tag');
    expect((await session().db.tags.get(created.id))?.attributes.name).toBe(
      'new-tag'
    );

    await renameTag(session(), '2', 'renamed');
    expect((await session().db.tags.get('2'))?.attributes.name).toBe('renamed');

    await deleteTag(session(), '3');
    expect((await session().db.tags.get('3'))?.attributes.is_deleted).toBe(
      true
    );
  });

  it('store an entry created in a tag, with its junction', async () => {
    await session().sync.syncAll();
    const entry = await createEntry(session(), 'subject', 'body', '2');

    expect(await inTag('2')).toEqual([entry.id]);
    expect((await session().db.entries.get(entry.id))?.attributes.subject).toBe(
      'subject'
    );
  });

  it('take an entry out of a tag at once, and sync the tag', async () => {
    await session().sync.syncAll();
    expect(await inTag('1')).toEqual(['1', '2', '3', '4']);

    await untagEntry(session(), '1', '2');
    expect(await inTag('1')).toEqual(['1', '3', '4']);
    // The tag's sync stores the API's deleted junction, and it stays out.
    await vi.waitFor(async () =>
      expect(
        (await session().db.junctions.get('2'))?.attributes.date_updated
      ).not.toBe('2020-04-13T18:20:00')
    );
    expect(await inTag('1')).toEqual(['1', '3', '4']);
  });

  it('delete an entry at once, which a stale copy never brings back', async () => {
    await session().sync.syncAll();
    const stale = await session().db.entries.get('4');

    await deleteEntry(session(), '4');
    expect((await session().db.entries.get('4'))?.attributes.is_deleted).toBe(
      true
    );
    // A page read before the delete, stored after it.
    if (stale !== undefined) {
      const {putEntries} = await import('../../../../src/lib/sync/store');
      await putEntries(session().db, [stale]);
    }
    expect((await session().db.entries.get('4'))?.attributes.is_deleted).toBe(
      true
    );
  });

  it("refuse to store another user's rows once the sync knows the user", async () => {
    await session().sync.syncAll();
    const answer = await apiClient.tagEntry('2', '1');
    vi.spyOn(apiClient, 'tagEntry').mockResolvedValue({
      ...answer,
      data: {
        ...answer.data,
        relationships: {
          ...answer.data.relationships,
          user: {data: {type: 'User', id: '2'}},
        },
      },
    });

    await expect(tagEntry(session(), '2', '3')).rejects.toBeInstanceOf(
      ForeignDataError
    );
    expect(await inTag('2')).toEqual([]);
  });
});
