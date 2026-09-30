/**
 * The entries page's sync (src/lib/data/useSync.ts) against the mock API:
 * the lists show what IndexedDB holds at once, and each sync's changes as it
 * stores them.
 */
import {act, render, screen, waitFor} from '@testing-library/react';
import {Dexie} from 'dexie';
import {createMemoryHistory} from 'history';
import {delay, HttpResponse, http} from 'msw';
import {type MockInstance, vi} from 'vitest';
import {SYNC_INTERVAL_MS} from '../../src/lib/data/useSync';
import {tagCursorKey} from '../../src/lib/db/database';
import {STORAGE_KEY} from '../../src/lib/state/appState';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {entry, junction, seed, tag} from '../util/storeFixtures';
import {TestAppRouter} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';
const JSON_API = {'Content-Type': 'application/vnd.api+json'};

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

let consoleError: MockInstance<typeof console.error>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // The mock API announces each request; a failing sync logs.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function renderAt(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

/** The entries the list shows (drag handle, subject, body), in order. */
const listed = () =>
  screen.queryAllByRole('entry').map(element => element.textContent ?? '');

/** Bring the app back into view, as much later as a sync waits for. */
function comeBackIntoView() {
  const later = Date.now() + SYNC_INTERVAL_MS;
  vi.spyOn(Date, 'now').mockReturnValue(later);
  act(() => {
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
    server.use(
      http.get('*/api/v1/user/', async () => {
        await delay('infinite');
      })
    );

    renderAt('/test/held');

    await waitFor(() => expect(listed()).toEqual(['::held-subjectbody-70']));
  });

  it('shows a change made elsewhere when the app comes back into view', async () => {
    renderAt('/test/test-tag-1');
    await waitFor(() => expect(listed()).toHaveLength(4));

    // Another device edits entry 1.
    await fetch(`${API}/entries/1`, {
      method: 'PATCH',
      headers: JSON_API,
      body: JSON.stringify({
        data: {type: 'TextEntry', id: '1', attributes: {subject: 'edited'}},
      }),
    });
    comeBackIntoView();

    await waitFor(() => expect(screen.getByText('edited')).toBeInTheDocument());
  });

  it('lists the tag shown, through its own sync, when the rest cannot sync', async () => {
    server.use(
      http.get('*/api/v1/entries', () =>
        HttpResponse.json({errors: []}, {status: 500})
      )
    );
    renderAt('/test/test-tag-1');

    await waitFor(() => expect(listed()).toHaveLength(4));
    expect(consoleError).toHaveBeenCalledWith(
      'ERROR: sync failed:',
      expect.any(Error)
    );
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
    const failures = () =>
      consoleError.mock.calls.filter(([message]) =>
        String(message).startsWith('ERROR: sync failed:')
      ).length;
    renderAt('/test/test-tag-1');
    // The collection's sync failed, and the tag's.
    // (vi.waitFor: its polling runs under the fake interval.)
    await vi.waitFor(() => expect(failures()).toBe(2));
    expect(listed()).toEqual([]);

    act(() => {
      vi.advanceTimersByTime(SYNC_INTERVAL_MS);
    });
    vi.useRealTimers();

    await waitFor(() => expect(listed()).toHaveLength(4));
    expect(tagReads).toBeGreaterThanOrEqual(2);
  });

  it('drops an entry untagged elsewhere from the tag shown', async () => {
    renderAt('/test/test-tag-1');
    await waitFor(() => expect(listed()).toHaveLength(4));

    const untagged = await fetch(`${API}/tags_entries/2`, {method: 'DELETE'});
    expect(untagged.status).toBe(204);
    comeBackIntoView();

    await waitFor(() => expect(listed()).toHaveLength(3));
    expect(listed().some(text => text.includes('entry-2-subject'))).toBe(false);
  });

  it("shows none of the last user's tags or entries once another signs in", async () => {
    renderAt('/test/test-tag-1');
    await waitFor(() => expect(listed()).toHaveLength(4));
    expect(screen.queryAllByRole('tag')).not.toEqual([]);

    // This tab takes up another tab's sign-in.
    act(() => store.setLoggedInUser('someone-else'));

    expect(listed()).toEqual([]);
    expect(screen.queryAllByRole('tag')).toEqual([]);
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
            },
          },
        })
      )
    );
    renderAt('/test/test-tag-1');

    await waitFor(() => expect(store.loggedInUser).toBeNull());
    expect(listed()).toEqual([]);
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
            },
          },
        })
      )
    );
    const test = syncSession(TEST_USER).db.name;
    renderAt('/test/test-tag-1');

    await waitFor(() => expect(store.loggedInUser).toBe('someone-else'));
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')).toMatchObject(
      {state: {loggedInUser: 'someone-else'}}
    );
    // The first user's data goes; the other's syncs.
    await waitFor(async () => expect(await Dexie.exists(test)).toBe(false));
    await waitFor(() => expect(listed()).toHaveLength(4));
  });
});
