/**
 * The entries page's sync (src/lib/data/useSync.ts) against the mock API:
 * the lists show what IndexedDB holds at once, and each sync's changes as it
 * stores them.
 */
import {DATA_VERSION_HEADER} from '@commandsnippets/api-shared';
import {act, screen, waitFor} from '@testing-library/react';
import {Dexie} from 'dexie';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';
import {type MockInstance, type MockResult, vi} from 'vitest';
import {SYNC_INTERVAL_MS} from '../../src/lib/data/useSync';
import {tagCursorKey} from '../../src/lib/db/database';
import * as appState from '../../src/lib/state/appState';
import {STORAGE_KEY} from '../../src/lib/state/appState';
import * as sessions from '../../src/lib/sync/session';
import {syncSession} from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {JSON_API} from '../util/documents';
import {mockResult} from '../util/mockResult';
import {API, serveMockApi, server} from '../util/msw';
import {queryRows} from '../util/rows';
import {signIn, store, TEST_USER} from '../util/signIn';
import {entry, junction, seed, tag} from '../util/storeFixtures';
import {renderAppAt} from '../util/TestAppRouter';

/** Another device's writes name the data version it holds: the first. */
const ELSEWHERE = {[DATA_VERSION_HEADER]: '1'};

const failedRequest = (what: string) =>
  expect.objectContaining({
    name: 'ApiRequestError',
    message: `Failed to ${what}: Internal Server Error`,
    status: 500,
  });

serveMockApi();

let consoleError: MockInstance<typeof console.error>;
let consoleWarn: MockInstance<typeof console.warn>;
let pageWork: ReturnType<typeof observePageWork>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // The mock API announces each request; a failing sync logs.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleError = vi.spyOn(console, 'error');
  consoleWarn = vi.spyOn(console, 'warn');
  pageWork = observePageWork();
});
afterEach(() => {
  vi.useRealTimers();
});

/** Observe the sessions the page actually uses, including replacements/public. */
function observePageWork() {
  const observed: {
    name: string;
    operation: {mock: {results: readonly MockResult<Promise<unknown>>[]}};
  }[] = [
    {name: 'isTagSynced', operation: vi.spyOn(syncReads, 'isTagSynced')},
    {name: 'endSyncSession', operation: vi.spyOn(sessions, 'endSyncSession')},
    {
      name: 'leaveForeignSession',
      operation: vi.spyOn(appState, 'leaveForeignSession'),
    },
  ];
  const known = new Set<sessions.SyncSession>();
  const observe = (session: sessions.SyncSession) => {
    if (known.has(session)) return session;
    known.add(session);
    for (const name of ['flush', 'syncAll', 'syncTag'] as const) {
      observed.push({
        name: `${session.username}/${session.owner}:${name}`,
        operation: vi.spyOn(session.sync, name),
      });
    }
    return session;
  };
  const own = sessions.syncSession;
  const publicSession = sessions.publicSyncSession;
  vi.spyOn(sessions, 'syncSession').mockImplementation((...args) =>
    observe(own(...args))
  );
  vi.spyOn(sessions, 'publicSyncSession').mockImplementation((...args) =>
    observe(publicSession(...args))
  );
  const joined = new Set<Promise<unknown>>();
  return {
    collections: () =>
      observed
        .filter(({name}) => name.endsWith(':syncAll'))
        .flatMap(({name, operation}) => operation.mock.results.map(() => name)),
    finish: async (expectedFailures: unknown[] = []) => {
      const failures: unknown[] = [];
      for (;;) {
        const pending: {name: string; promise: Promise<unknown>}[] = [];
        for (const {name, operation} of observed) {
          for (let index = 0; index < operation.mock.results.length; index++) {
            const promise = mockResult<Promise<unknown>>(operation, index);
            if (!joined.has(promise)) {
              joined.add(promise);
              pending.push({name, promise});
            }
          }
        }
        if (pending.length === 0) break;
        await act(async () => {
          // Keep the original returns; every deliberate failure is asserted
          // by its scenario, never allowed through by a shared error filter.
          const results = await Promise.allSettled(
            pending.map(({promise}) => promise)
          );
          for (const [index, result] of results.entries()) {
            if (result.status === 'rejected') {
              const operation = pending[index];
              invariant(operation, 'the rejected operation was observed');
              failures.push({name: operation.name, reason: result.reason});
            }
          }
        });
      }
      expect(failures).toEqual(expectedFailures);
    },
  };
}

/** The entries the list shows (drag handle, subject, body), in order. */
const listed = () =>
  queryRows('entry').map(element => element.textContent ?? '');

/** Bring the app back into view, as much later as a sync waits for. */
async function comeBackIntoView() {
  const later = Date.now() + SYNC_INTERVAL_MS;
  vi.spyOn(Date, 'now').mockReturnValue(later);
  await act(async () => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
}

describe('The entries page', () => {
  it('lists a tag the database holds at once, while the sync runs', async () => {
    await seed([
      tag('7', {name: 'held'}),
      entry('70', {subject: 'held-subject'}, ['700']),
      junction('700', '7', '70'),
    ]);
    // Synced through its revision: nothing to ask for it.
    const {db} = syncSession(TEST_USER);
    const held = await db.tags.get([TEST_USER, '7']);
    await db.cursors.put({
      owner: TEST_USER,
      key: tagCursorKey('7'),
      after: '2020-01-01T00:00:00,700',
      revision: held?.attributes.date_updated ?? '',
    });
    const ownerRead = Promise.withResolvers<void>();
    const requested = Promise.withResolvers<void>();
    const readOwner = vi.fn(async () => {
      requested.resolve();
      await ownerRead.promise;
      return undefined;
    });
    server.use(http.get('*/api/v1/user/', readOwner));

    renderAppAt('/test/held');

    try {
      await act(async () => requested.promise);
      await waitFor(() => expect(listed()).toEqual(['::held-subjectbody-70']));
    } finally {
      await act(async () => ownerRead.resolve());
      await pageWork.finish();
    }
    expect(pageWork.collections()).toEqual(['test/test:syncAll']);
    expect(readOwner).toHaveBeenCalledTimes(2);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('shows a change made elsewhere when the app comes back into view', async () => {
    renderAppAt('/test/test-tag-1');
    await waitFor(() => expect(listed()).toHaveLength(4));
    await pageWork.finish();

    // Another device edits entry 1.
    await fetch(`${API}/entries/1`, {
      method: 'PATCH',
      headers: {...JSON_API, ...ELSEWHERE},
      body: JSON.stringify({
        data: {type: 'TextEntry', id: '1', attributes: {subject: 'edited'}},
      }),
    });
    await comeBackIntoView();

    expect(await screen.findByText('edited')).toBeInTheDocument();
    await pageWork.finish();
    expect(pageWork.collections()).toEqual([
      'test/test:syncAll',
      'test/test:syncAll',
    ]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it('lists the tag shown, through its own sync, when the rest cannot sync', async () => {
    server.use(
      http.get('*/api/v1/entries', () =>
        HttpResponse.json({errors: []}, {status: 500})
      )
    );
    renderAppAt('/test/test-tag-1');

    await waitFor(() => expect(listed()).toHaveLength(4));
    expect(consoleError).toHaveBeenCalledWith(
      'ERROR: sync failed:',
      expect.any(Error)
    );
    await pageWork.finish([
      {
        name: 'test/test:syncAll',
        reason: failedRequest('sync entries'),
      },
    ]);
    expect(pageWork.collections()).toEqual(['test/test:syncAll']);
    expect(consoleError.mock.calls).toEqual([
      ['ERROR: sync failed:', failedRequest('sync entries')],
    ]);
    expect(consoleWarn.mock.calls).toEqual([
      ['WARNING: could not count entry pages:', failedRequest('count entries')],
    ]);
  });

  it('retries the tag shown every half minute while its sync fails', async () => {
    vi.useFakeTimers({toFake: ['setInterval', 'clearInterval']});
    let tagReads = 0;
    server.use(
      http.get('*/api/v1/entries', () =>
        HttpResponse.json({errors: []}, {status: 500})
      ),
      // The tag's junctions fail once; the mark the collection sync reads
      // first goes through.
      http.get('*/api/v1/tags_entries', ({request}) => {
        const url = new URL(request.url);
        if (url.searchParams.get('filter[tag.id]') === null) {
          return undefined;
        }
        tagReads += 1;
        return tagReads === 1
          ? HttpResponse.json({errors: []}, {status: 500})
          : undefined;
      })
    );
    renderAppAt('/test/test-tag-1');
    // Join actual failed work under act, not vi.waitFor's polling of console
    // output (which leaves its React updates outside act).
    await pageWork.finish([
      {
        name: 'test/test:syncAll',
        reason: failedRequest('sync entries'),
      },
      {
        name: 'test/test:syncTag',
        reason: failedRequest('sync tag'),
      },
    ]);

    expect(listed()).toEqual([]);
    expect(consoleError).toHaveBeenCalledTimes(2);
    expect(tagReads).toBe(1);
    await act(async () => {
      vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(listed()).toHaveLength(4));
    expect(tagReads).toBeGreaterThanOrEqual(2);
    await pageWork.finish([
      {
        name: 'test/test:syncAll',
        reason: failedRequest('sync entries'),
      },
    ]);
    expect(pageWork.collections()).toEqual([
      'test/test:syncAll',
      'test/test:syncAll',
    ]);
    expect(consoleError.mock.calls).toEqual([
      ['ERROR: sync failed:', failedRequest('sync entries')],
      ['ERROR: sync failed:', failedRequest('sync tag')],
      ['ERROR: sync failed:', failedRequest('sync entries')],
    ]);
    const countFailure = [
      'WARNING: could not count entry pages:',
      failedRequest('count entries'),
    ];
    expect(consoleWarn.mock.calls).toEqual([countFailure, countFailure]);
    expect(tagReads).toBe(2);
  });

  it('drops an entry untagged elsewhere from the tag shown', async () => {
    renderAppAt('/test/test-tag-1');
    await waitFor(() => expect(listed()).toHaveLength(4));
    await pageWork.finish();

    const untagged = await fetch(`${API}/tags_entries/2`, {
      method: 'DELETE',
      headers: ELSEWHERE,
    });
    expect(untagged.status).toBe(200);
    await comeBackIntoView();

    await waitFor(() => expect(listed()).toHaveLength(3));
    expect(listed().some(text => text.includes('entry-2-subject'))).toBe(false);
    await pageWork.finish();
    expect(pageWork.collections()).toEqual([
      'test/test:syncAll',
      'test/test:syncAll',
    ]);
    expect(consoleError).not.toHaveBeenCalled();
    expect(consoleWarn).not.toHaveBeenCalled();
  });

  it("shows none of the last user's tags or entries once another signs in", async () => {
    const tagRead = Promise.withResolvers<void>();
    const requested = Promise.withResolvers<void>();
    const readTag = vi.fn(async ({request}: {request: Request}) => {
      if (new URL(request.url).searchParams.get('filter[tag.id]') === null) {
        return undefined;
      }
      requested.resolve();
      await tagRead.promise;
      return undefined;
    });
    server.use(http.get('*/api/v1/tags_entries', readTag));
    renderAppAt('/test/test-tag-1');
    try {
      await waitFor(() => expect(listed()).toHaveLength(4));
      expect(queryRows('tag')).not.toEqual([]);
      await act(async () => requested.promise);

      // This tab takes up another tab's sign-in while the old tag read is
      // still in flight, not after artificially draining the old session.
      act(() => store.setLoggedInUser('someone-else'));

      expect(listed()).toEqual([]);
      expect(queryRows('tag')).toEqual([]);
    } finally {
      await act(async () => tagRead.resolve());
      await pageWork.finish([
        {
          name: 'test/test:syncTag',
          reason: expect.objectContaining({name: 'DatabaseClosedError'}),
        },
        {
          name: 'someone-else/someone-else:flush',
          reason: expect.objectContaining({
            name: 'SyncUserError',
            message: "The API's user is test, not someone-else: not synced",
          }),
        },
        {
          name: 'someone-else/someone-else:syncAll',
          reason: expect.objectContaining({name: 'DatabaseClosedError'}),
        },
        {
          name: '/someone-else:syncAll',
          reason: expect.objectContaining({
            name: 'PublicViewChangedError',
            restart: false,
          }),
        },
      ]);
    }
    expect(pageWork.collections()).toEqual([
      'test/test:syncAll',
      '/test:syncAll',
      'someone-else/someone-else:syncAll',
      '/someone-else:syncAll',
    ]);
    expect(readTag).toHaveBeenCalledTimes(2);
    expect(consoleError.mock.calls).toEqual([
      [
        'ERROR: sync failed:',
        expect.objectContaining({name: 'DatabaseClosedError'}),
      ],
      [
        'ERROR: sync failed:',
        expect.objectContaining({name: 'DatabaseClosedError'}),
      ],
      [
        'ERROR: sync failed:',
        expect.objectContaining({
          name: 'PublicViewChangedError',
          restart: false,
        }),
      ],
    ]);
    await act(async () => appState.signedOutDataCleanedUp());
  });

  it('signs out when the API answers for another user', async () => {
    // Another tab signed in as someone else: the cookie is theirs now.
    server.use(
      http.get('*/api/v1/user/', () =>
        HttpResponse.json({
          data: {
            type: 'User',
            id: '2',
            attributes: {
              username: 'someone-else',
              is_staff: false,
              date_updated: '2020-01-01T00:00:00',
              data_version: 1,
            },
          },
        })
      )
    );
    renderAppAt('/test/test-tag-1');

    await waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(listed()).toEqual([]);
    await pageWork.finish([
      {
        name: 'test/test:flush',
        reason: expect.objectContaining({
          name: 'SyncUserError',
          message: "The API's user is someone-else, not test: not synced",
        }),
      },
      {
        name: 'test/test:syncAll',
        reason: expect.objectContaining({name: 'DatabaseClosedError'}),
      },
    ]);
    expect(pageWork.collections()).toEqual([
      'test/test:syncAll',
      '/test:syncAll',
    ]);
    expect(consoleError.mock.calls).toEqual([
      [
        'ERROR: sync failed:',
        expect.objectContaining({name: 'DatabaseClosedError'}),
      ],
    ]);
    await act(async () => appState.signedOutDataCleanedUp());
    const {db} = syncSession(TEST_USER);
    expect(await db.entries.count()).toBe(0);
  });

  it("takes up the sign-in another tab saved, leaving it that tab's", async () => {
    // Another tab signed in as someone else, and saved it.
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        ...saved,
        state: {...saved.state, loggedInUser: 'someone-else'},
      })
    );
    server.use(
      http.get('*/api/v1/user/', () =>
        HttpResponse.json({
          data: {
            type: 'User',
            id: '1',
            attributes: {
              username: 'someone-else',
              is_staff: false,
              date_updated: '2020-01-01T00:00:00',
              data_version: 1,
            },
          },
        })
      )
    );
    const test = syncSession(TEST_USER).db.name;
    renderAppAt('/test/test-tag-1');

    await waitFor(() => expect(store.loggedInUser).toBe('someone-else'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject(
      {state: {loggedInUser: 'someone-else'}}
    );
    // The first user's data goes; the other's syncs.
    await waitFor(async () => expect(await Dexie.exists(test)).toBe(false));
    await waitFor(() => expect(listed()).toHaveLength(4));
    await pageWork.finish([
      {
        name: 'test/test:flush',
        reason: expect.objectContaining({
          name: 'SyncUserError',
          message: "The API's user is someone-else, not test: not synced",
        }),
      },
      {
        name: 'test/test:syncAll',
        reason: expect.objectContaining({name: 'DatabaseClosedError'}),
      },
    ]);
    expect(pageWork.collections()).toEqual([
      'test/test:syncAll',
      '/test:syncAll',
      'someone-else/someone-else:syncAll',
    ]);
    expect(consoleError.mock.calls).toEqual([
      [
        'ERROR: sync failed:',
        expect.objectContaining({name: 'DatabaseClosedError'}),
      ],
    ]);
    await act(async () => appState.signedOutDataCleanedUp());
  });
});
