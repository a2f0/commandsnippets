// Load the model before anything imports the store module. When the API
// client's 401/403 handling imported the store, this order hit the import
// cycle (store -> RootModel -> API client -> store) and RootModel was not yet
// initialized when the store module created it.

import type {
  IncludedResource,
  Tag,
  TagTextEntry,
  TextEntry,
  User,
} from '@commandsnippets/api-shared';
import {getSnapshot} from 'mobx-state-tree';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';
import {vi} from 'vitest';
import {RootModel} from '../../../../../src/lib/store/models/RootModel';
import {onePage} from '../../../../../src/msw/documents';
import {createStore, tag, testUser} from '../../../../util/storeFixtures';

describe('RootModel', () => {
  it('can be imported and created before the store module', () => {
    const root = RootModel.create({
      selectedTheme: 'darkTheme',
      tagSortOrder: 'order',
      entryNew: null,
      tagTextEntryThroughModelSortOrder: 'order',
      entrySortOrder: 'date_updated',
      tagNew: null,
      tagSearch: false,
      mostRecentCopyType: null,
      mostRecentCopyID: null,
      currentTag: null,
      currentUser: null,
      showTagCounts: false,
      allEntriesCacheTimestamp: '1970-01-01T00:00:00.000Z',
    });

    expect(root.loggedInUser).toBeNull();
    expect(root.isStaff).toBe(false);
    expect(root.tagSortOrder).toBe('order');
  });
});

const API = 'http://localhost:9001/api/v1';
const owner = {user: {data: {type: 'User', id: '1'}}} as const;
const apiUser: User = {
  ...testUser,
  attributes: {...testUser.attributes, is_staff: false},
};

const server = setupServer();
beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

/** Entry `id` as the API sends it, in the tags of `junctions`. */
function apiEntry(
  id: string,
  dateUpdated: string,
  junctions: TagTextEntry[] = [],
  subject = `subject-${id}`
): TextEntry {
  return {
    type: 'TextEntry',
    id,
    attributes: {
      body: `body-${id}`,
      subject,
      date_updated: dateUpdated,
      date_created: '2020-01-01T00:00:00',
      reused_count: 0,
      is_deleted: false,
      tag_count: junctions.length,
    },
    relationships: {
      ...owner,
      text_entry_to_tag: {
        data: junctions.map(({type, id}) => ({type, id})),
        meta: {count: junctions.length},
      },
    },
  };
}

/** Junction `id`, tagging entry `entryId` with tag `tagId`. */
function apiJunction(id: string, tagId: string, entryId: string): TagTextEntry {
  return {
    type: 'TagTextEntryThroughModel',
    id,
    attributes: {
      order: Number(id),
      date_updated: '2020-01-01T00:00:00',
      date_created: '2020-01-01T00:00:00',
    },
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
      ...owner,
    },
  };
}

/** The entries of a list response, with their junctions and `extra`. */
function entriesDocument(
  url: string,
  entries: TextEntry[],
  junctions: TagTextEntry[],
  extra: IncludedResource[] = []
) {
  return {
    ...onePage(url, entries.length),
    data: entries,
    included: [...junctions, ...extra, apiUser],
  };
}

describe('syncTagEntries', () => {
  // The query of each entries request.
  let requests: URLSearchParams[];
  /** Answer entries requests with `respond(query)`'s document. */
  function serveEntries(
    respond: (query: URLSearchParams, url: string) => object
  ) {
    requests = [];
    server.use(
      http.get(`${API}/entries`, ({request}) => {
        const query = new URL(request.url).searchParams;
        requests.push(query);
        return HttpResponse.json(respond(query, request.url));
      })
    );
  }

  const tagged = apiJunction('100', '1', '10');
  const alsoTagged = apiJunction('101', '1', '11');

  it('reads a tag whole on its first sync, then nothing while its revision stays', async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 1}),
    ]);
    serveEntries((_query, url) =>
      entriesDocument(
        url,
        [apiEntry('10', '2024-01-02T00:00:00', [tagged])],
        [tagged]
      )
    );

    expect(await store.syncTagEntries('test', 'tag-1')).toBe(true);
    expect(requests).toHaveLength(1);
    expect(requests[0]?.get('filter[tags.id]')).toBe('1');
    expect(requests[0]?.has('filter[date_updated.gt]')).toBe(false);
    expect(store.textEntriesArray.map(entry => entry.id)).toEqual(['10']);
    expect(store.tagTextEntryThroughModel.map(link => link.id)).toEqual([
      '100',
    ]);
    expect(getSnapshot(store.tagSyncCursors)).toEqual({
      '1': {tag: '2024-01-01T00:00:00', entries: '2024-01-02T00:00:00'},
    });

    expect(await store.syncTagEntries('test', 'tag-1')).toBe(false);
    expect(requests).toHaveLength(1);
  });

  it('reads what changed since its last sync once the revision moves, and reports only changes', async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 1}),
    ]);
    serveEntries((_query, url) =>
      entriesDocument(
        url,
        [apiEntry('10', '2024-01-02T00:00:00', [tagged])],
        [tagged]
      )
    );
    await store.syncTagEntries('test', 'tag-1');

    // An edit elsewhere: the tags sync brings the tag's new revision.
    store.updateOrCreateTag(
      tag('1', {date_updated: '2024-02-01T00:00:00', entry_count: 1})
    );
    const edited = apiEntry('10', '2024-02-01T00:00:00', [tagged], 'edited');
    serveEntries((_query, url) => entriesDocument(url, [edited], [tagged]));
    expect(await store.syncTagEntries('test', 'tag-1')).toBe(true);
    expect(requests[0]?.get('filter[date_updated.gt]')).toBe(
      '2024-01-02T00:00:00'
    );
    expect(store.textEntriesArray[0]?.attributes.subject).toBe('edited');

    // A newer revision whose changes the store holds already.
    store.updateOrCreateTag(
      tag('1', {date_updated: '2024-03-01T00:00:00', entry_count: 1})
    );
    expect(await store.syncTagEntries('test', 'tag-1')).toBe(false);
    expect(requests).toHaveLength(2);
    expect(store.tagSyncCursors.get('1')?.tag).toBe('2024-03-01T00:00:00');
  });

  it("keeps its cursor through the app's own writes", async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 1}),
    ]);
    serveEntries((_query, url) =>
      entriesDocument(
        url,
        [apiEntry('10', '2024-01-02T00:00:00', [tagged])],
        [tagged]
      )
    );
    await store.syncTagEntries('test', 'tag-1');

    // Saving an edit stores the entry's new revision...
    store.updateOrCreateTextEntry(apiEntry('10', '2024-05-01T00:00:00'));
    store.updateOrCreateTag(
      tag('1', {date_updated: '2024-05-01T00:00:00', entry_count: 1})
    );
    serveEntries((_query, url) => entriesDocument(url, [], []));
    await store.syncTagEntries('test', 'tag-1');
    // ...but changes made elsewhere before it are still asked for.
    expect(requests[0]?.get('filter[date_updated.gt]')).toBe(
      '2024-01-02T00:00:00'
    );
  });

  it('drops the links of entries that left the tag', async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 2}),
    ]);
    const entries = [
      apiEntry('10', '2024-01-02T00:00:00', [tagged]),
      apiEntry('11', '2024-01-03T00:00:00', [alsoTagged]),
    ];
    serveEntries((_query, url) =>
      entriesDocument(url, entries, [tagged, alsoTagged])
    );
    await store.syncTagEntries('test', 'tag-1');
    expect(store.tagTextEntryThroughModel).toHaveLength(2);

    // Entry 11 was untagged elsewhere: no change lists it any more.
    store.updateOrCreateTag(
      tag('1', {date_updated: '2024-02-01T00:00:00', entry_count: 1})
    );
    serveEntries((query, url) =>
      query.has('filter[date_updated.gt]')
        ? entriesDocument(url, [], [])
        : entriesDocument(url, [entries[0] as TextEntry], [tagged])
    );
    expect(await store.syncTagEntries('test', 'tag-1')).toBe(true);
    expect(requests.map(query => query.has('filter[date_updated.gt]'))).toEqual(
      [true, false]
    );
    expect(store.tagTextEntryThroughModel.map(link => link.id)).toEqual([
      '100',
    ]);
    // The entry stays: it can be in other tags, or untagged.
    expect(store.textEntriesArray).toHaveLength(2);
  });

  it('syncs a tag whose revision has not moved when forced', async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 1}),
    ]);
    serveEntries((_query, url) =>
      entriesDocument(
        url,
        [apiEntry('10', '2024-01-02T00:00:00', [tagged])],
        [tagged]
      )
    );
    await store.syncTagEntries('test', 'tag-1');
    const reranked = {
      ...tagged,
      attributes: {
        ...tagged.attributes,
        order: 7,
        date_updated: '2024-01-05T00:00:00',
      },
    };
    serveEntries((_query, url) =>
      entriesDocument(
        url,
        [apiEntry('10', '2024-01-05T00:00:00', [reranked])],
        [reranked]
      )
    );
    expect(await store.syncTagEntries('test', 'tag-1', true)).toBe(true);
    expect(requests).toHaveLength(1);
    expect(store.tagTextEntryThroughModel[0]?.attributes.order).toBe(7);
  });

  it('runs one sync of a tag at a time, each reporting the changes it waited for', async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 1}),
    ]);
    serveEntries((_query, url) =>
      entriesDocument(
        url,
        [apiEntry('10', '2024-01-02T00:00:00', [tagged])],
        [tagged]
      )
    );
    const results = await Promise.all([
      store.syncTagEntries('test', 'tag-1'),
      store.syncTagEntries('test', 'tag-1'),
    ]);
    // The second waited for the first, and reports its changes.
    expect(results).toEqual([true, true]);
    expect(requests).toHaveLength(1);
  });

  it('leaves the cursor as it was when a sync fails, so the next one retries', async () => {
    const store = createStore([
      tag('1', {date_updated: '2024-01-01T00:00:00', entry_count: 0}),
    ]);
    server.use(
      http.get(`${API}/entries`, () =>
        HttpResponse.json({errors: []}, {status: 500})
      )
    );
    await expect(store.syncTagEntries('test', 'tag-1')).rejects.toThrow(
      'Failed to fetch entries'
    );
    expect(store.tagSyncCursors.has('1')).toBe(false);

    serveEntries((_query, url) => entriesDocument(url, [], []));
    expect(await store.syncTagEntries('test', 'tag-1')).toBe(false);
    expect(requests).toHaveLength(1);
    expect(getSnapshot(store.tagSyncCursors)).toEqual({
      '1': {tag: '2024-01-01T00:00:00', entries: null},
    });
  });

  it('asks for nothing for a tag the store does not hold', async () => {
    const store = createStore([]);
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    expect(await store.syncTagEntries('test', 'tag-1')).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    fetchSpy.mockRestore();
  });
});

describe('fetchTags', () => {
  it("syncs from the newest revision its syncs listed, not the app's own writes", async () => {
    const store = createStore([]);
    const since: Array<string | null> = [];
    const listed: Tag = tag('1', {date_updated: '2024-01-01T00:00:00'});
    server.use(
      http.get(`${API}/tags`, ({request}) => {
        const query = new URL(request.url).searchParams;
        since.push(query.get('filter[date_updated.gt]'));
        return HttpResponse.json({
          ...onePage(request.url, 1),
          data: query.has('filter[date_updated.gt]') ? [] : [listed],
        });
      })
    );
    await store.fetchTags('test');
    expect(store.tagsSyncedThrough).toBe('2024-01-01T00:00:00');

    // A rename stores the tag's new revision.
    store.updateOrCreateTag(
      tag('1', {name: 'renamed', date_updated: '2024-06-01T00:00:00'})
    );
    await store.fetchTags('test');
    expect(since).toEqual([null, '2024-01-01T00:00:00']);
    expect(store.tagsSyncedThrough).toBe('2024-01-01T00:00:00');
  });
});
