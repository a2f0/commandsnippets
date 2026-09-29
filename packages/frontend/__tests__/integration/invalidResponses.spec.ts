/**
 * An OK response that breaks the API contract fails the sync that asked for
 * it: nothing from it reaches the database, its cursor stays where it was,
 * and the user stays signed in (src/lib/api/parseResponse.ts).
 */
import {CURSOR_START} from '@commandsnippets/api-shared';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw';
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
import {syncSession} from '../../src/lib/sync/session';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  // The mock API announces each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});

/** The database's rows and cursors, to compare before and after. */
async function contents() {
  const {db} = syncSession(TEST_USER);
  return {
    tags: await db.tags.toArray(),
    entries: await db.entries.toArray(),
    junctions: await db.junctions.toArray(),
    cursors: await db.cursors.toArray(),
  };
}

describe('A response that breaks the contract', () => {
  it('leaves the database as it was, signed in', async () => {
    const {sync} = syncSession(TEST_USER);
    await sync.syncAll();
    const before = await contents();
    expect(before.tags).toHaveLength(4);

    // A newer version of a tag, which would replace the stored one, with a
    // rank the contract refuses.
    server.use(
      http.get('*/api/v1/tags', () =>
        HttpResponse.json({
          links: {next: null},
          data: [
            {
              ...before.tags[0],
              attributes: {
                ...before.tags[0]?.attributes,
                name: 'renamed',
                date_updated: '2030-01-01T00:00:00',
                order: -1,
              },
            },
          ],
        })
      )
    );
    await expect(sync.syncAll()).rejects.toBeInstanceOf(InvalidResponseError);

    expect(await contents()).toEqual(before);
    expect(store.loggedInUser).toBe(TEST_USER);
  });

  it('keeps the pages read before a broken one, and goes on from them', async () => {
    const {db, sync} = syncSession(TEST_USER);
    // A first page of one entry, which a broken one follows.
    const [first] = entriesResponse.data;
    invariant(first, 'the fixture has entries');
    const junction = entriesResponse.included?.find(
      resource =>
        resource.type === 'TagTextEntryThroughModel' &&
        resource.relationships.text_entry.data.id === first.id
    );
    invariant(junction, 'the fixture tags its entries');
    server.use(
      http.get('*/api/v1/entries', ({request}) => {
        const after = new URL(request.url).searchParams.get('page[after]');
        return after === CURSOR_START
          ? HttpResponse.json({
              links: {next: `${request.url}&next`},
              data: [first],
              included: [junction],
            })
          : HttpResponse.json({
              links: {next: null},
              data: [{type: 'TextEntry', id: '5'}],
            });
      })
    );

    await expect(sync.syncAll()).rejects.toBeInstanceOf(InvalidResponseError);
    // The first page, with its cursor; no tag claims a sync.
    expect(await db.entries.count()).toBe(1);
    const cursor = await db.cursors.get('entries');
    expect(cursor).toBeDefined();
    expect(await db.cursors.where('key').startsWith('tag:').count()).toBe(0);
    expect(store.loggedInUser).toBe(TEST_USER);

    // The next sync goes on from the first page.
    server.resetHandlers();
    await sync.syncAll();
    expect(await db.entries.count()).toBe(4);
  });
});
