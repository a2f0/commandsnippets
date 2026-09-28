/**
 * An OK response that breaks the API contract fails the sync that asked for
 * it: nothing from it reaches the store, and the user stays signed in
 * (src/lib/api/parseResponse.ts).
 */

import invariant from 'invariant';
import {applySnapshot, getSnapshot} from 'mobx-state-tree';
import {HttpResponse, http} from 'msw';
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

import {InvalidResponseError} from '../../src/lib/api/parseResponse';
import {defaultState} from '../../src/lib/shared';
import {store} from '../../src/lib/store/store';
import {pagination} from '../../src/msw/documents';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {tagsResponse} from '../../test/mocks/tags/tagsResponse';

const API = 'http://localhost:9001/api/v1';

const server = setupServer();

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());
beforeEach(() => {
  applySnapshot(store, {...defaultState, loggedInUser: 'test'});
  // The store's syncs log their failures.
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  applySnapshot(store, defaultState);
});

describe('A response that breaks the contract', () => {
  it('leaves the store as it was, signed in', async () => {
    const [first, ...rest] = tagsResponse.data;
    invariant(first, 'the fixture has tags');
    server.use(http.get(`${API}/tags`, () => HttpResponse.json(tagsResponse)));
    await store.fetchTags('test');
    expect(store.tagsArray).toHaveLength(4);
    const before = getSnapshot(store);

    // A newer version of a tag, which would replace the stored one.
    server.use(
      http.get(`${API}/tags`, () =>
        HttpResponse.json({
          ...tagsResponse,
          data: [
            {
              ...first,
              attributes: {
                ...first.attributes,
                name: 'renamed',
                date_updated: '2030-01-01T00:00:00',
                order: -1,
              },
            },
            ...rest,
          ],
        })
      )
    );
    await expect(store.fetchTags('test')).rejects.toBeInstanceOf(
      InvalidResponseError
    );

    expect(getSnapshot(store)).toEqual(before);
    expect(store.loggedInUser).toBe('test');
  });

  it('fails the whole sync when a later page breaks it', async () => {
    server.use(
      http.get(`${API}/entries`, ({request}) => {
        const page = new URL(request.url).searchParams.get('page[number]');
        return page === '1'
          ? HttpResponse.json({
              ...entriesResponse,
              ...pagination(request.url, 1, 2, 5),
            })
          : HttpResponse.json({
              ...pagination(request.url, 2, 2, 5),
              data: [{type: 'TextEntry', id: '5'}],
            });
      })
    );

    await expect(
      store.fetchTextEntries('test', 'test-tag-1')
    ).rejects.toBeInstanceOf(InvalidResponseError);

    // Not even the first page's entries.
    expect(store.textEntriesArray).toHaveLength(0);
    expect(store.tagTextEntryThroughModel).toHaveLength(0);
    expect(store.loggedInUser).toBe('test');
  });
});
