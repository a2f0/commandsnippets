/**
 * Signing out with writes not sent yet (`lib/state/signOutWarning.ts`): the
 * queue is sent first; when writes are still unsent, the user is warned and
 * chooses to stay, to sign out keeping them on this device, or to discard
 * them.
 */
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {Dexie} from 'dexie';
import {HttpResponse, http} from 'msw/http';
import {type MockResult, vi} from 'vitest';
import {ApiRequestError} from '../../src/lib/api/errors';
import {createTag} from '../../src/lib/data/writes';
import {signedOutDataCleanedUp} from '../../src/lib/state/appState';
import * as signOutWarning from '../../src/lib/state/signOutWarning';
import {
  cancelSignOut,
  confirmSignOut,
  requestSignOut,
  signOutTiming,
} from '../../src/lib/state/signOutWarning';
import * as sessions from '../../src/lib/sync/session';
import {hasQueuedWrites, syncSession} from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {
  API,
  HOST,
  offlineForWrites,
  recordRequests,
  serveMockApi,
  server,
} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
let pageSyncs: ReturnType<typeof observePageSyncs>;
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  pageSyncs = observePageSyncs();
});
afterEach(async () => {
  try {
    await act(() => signedOutDataCleanedUp());
    await pageSyncs.finish();
  } finally {
    cleanup();
  }
});

/** Writes/flushes are awaited by each test; follow the page's reads too. */
function observePageSyncs() {
  const observed: {mock: {results: readonly MockResult<Promise<unknown>>[]}}[] =
    [vi.spyOn(syncReads, 'isTagSynced')];
  const known = new Set<sessions.SyncSession>();
  const observe = (session: sessions.SyncSession) => {
    if (!known.has(session)) {
      known.add(session);
      observed.push(
        vi.spyOn(session.sync, 'syncAll'),
        vi.spyOn(session.sync, 'syncTag')
      );
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
    finish: async (expectedFailures: unknown[] = []) => {
      const failures: unknown[] = [];
      for (;;) {
        const pending = observed
          .flatMap(operation =>
            operation.mock.results.map((_, index) =>
              mockResult<Promise<unknown>>(operation, index)
            )
          )
          .filter(promise => !joined.has(promise));
        if (pending.length === 0) break;
        for (const promise of pending) joined.add(promise);
        await act(async () => {
          for (const result of await Promise.allSettled(pending)) {
            if (result.status === 'rejected') failures.push(result.reason);
          }
        });
      }
      expect(failures).toEqual(expectedFailures);
    },
  };
}

async function logOut() {
  const {history} = await act(async () => renderAppAt('/test/test-tag-1'));
  await screen.findByText('test-tag-1');
  await pageSyncs.finish();
  const requested = vi.spyOn(signOutWarning, 'requestSignOut');
  return {
    history,
    click: async () => {
      const menu = await screen.findByRole('menu', {name: 'File'});
      await act(async () => fireEvent.click(menu));
      const logout = await screen.findByText('Logout');
      const index = requested.mock.calls.length;
      await act(async () => {
        fireEvent.click(logout);
        expect(requested).toHaveBeenCalledTimes(index + 1);
        await mockResult(requested, index);
        await signedOutDataCleanedUp();
      });
      await pageSyncs.finish();
    },
  };
}

async function confirm(name: 'Sign out' | 'Discard and sign out') {
  const confirmed = vi.spyOn(signOutWarning, 'confirmSignOut');
  const button = await screen.findByRole('button', {name});
  const index = confirmed.mock.calls.length;
  await act(async () => {
    fireEvent.click(button);
    expect(confirmed).toHaveBeenCalledTimes(index + 1);
    await mockResult(confirmed, index);
    await signedOutDataCleanedUp();
  });
  await pageSyncs.finish();
}

/** A write queued while the API cannot be reached. */
async function queueOffline() {
  offlineForWrites();
  const session = syncSession(TEST_USER);
  await act(async () => {
    await createTag(session, 'unsent');
    await expect(session.sync.flush()).rejects.toThrow();
  });
  return session.db.name;
}

it('signs out at once when every write has been sent', async () => {
  const {history, click} = await logOut();
  await click();

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
  expect(screen.queryByText('Changes not saved yet')).toBeNull();
});

it('sends the queue first, then signs out without warning', async () => {
  const {history, click} = await logOut();
  const name = await queueOffline();
  // Back online.
  server.resetHandlers();
  await click();

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(screen.queryByText('Changes not saved yet')).toBeNull();
  await signedOutDataCleanedUp();
  expect(await Dexie.exists(name)).toBe(false);
});

it('warns of writes still unsent, and stays signed in when cancelled', async () => {
  const {history, click} = await logOut();
  const name = await queueOffline();
  await click();

  expect(await screen.findByText('Changes not saved yet')).toBeInTheDocument();
  expect(
    screen.getByText(/1 change on this device has not reached the server/)
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', {name: 'Cancel'}));

  await waitFor(() =>
    expect(screen.queryByText('Changes not saved yet')).toBeNull()
  );
  expect(store.loggedInUser).toBe(TEST_USER);
  expect(history.location.pathname).toBe('/test/test-tag-1');
  expect(await hasQueuedWrites(name)).toBe(true);
});

it('signs out keeping the unsent writes on this device', async () => {
  const {history, click} = await logOut();
  const name = await queueOffline();
  await click();
  await confirm('Sign out');

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
  await signedOutDataCleanedUp();
  expect(await hasQueuedWrites(name)).toBe(true);
});

it('signs out discarding the unsent writes', async () => {
  const {history, click} = await logOut();
  const name = await queueOffline();
  await click();
  await confirm('Discard and sign out');

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
  await signedOutDataCleanedUp();
  expect(await Dexie.exists(name)).toBe(false);
});

it("never acts on a warning left from another account's sign-out", async () => {
  const errors = vi.spyOn(console, 'error');
  const {click} = await logOut();
  await queueOffline();
  await click();
  expect(await screen.findByText('Changes not saved yet')).toBeInTheDocument();

  // Another account signs in here meanwhile (another tab's sign-in taken
  // up): the warning goes, and a confirmation left from it does nothing.
  await act(async () => {
    store.setLoggedInUser('alice');
    await signedOutDataCleanedUp();
  });
  // Changing account interrupts a read captured by the previous render.
  const interrupted = expect.objectContaining({
    name: 'DatabaseClosedError',
    message: 'DatabaseClosedError Database has been closed',
  });
  await pageSyncs.finish([interrupted]);
  await waitFor(() =>
    expect(screen.queryByText('Changes not saved yet')).toBeNull()
  );
  const signOuts = recordRequests(({url}, path) =>
    path === '/api-token-deauth/' ? url : undefined
  );
  await act(() => confirmSignOut({discardQueued: true}));
  expect(signOuts).toEqual([]);
  expect(errors.mock.calls).toEqual([['ERROR: sync failed:', interrupted]]);
});

it('discards the unsent writes though the session ended as the user signed out', async () => {
  const errors = vi.spyOn(console, 'error');
  const {history, click} = await logOut();
  const name = await queueOffline();
  await click();
  await screen.findByText('Changes not saved yet');
  // The API answers the sign-out 401: the session was gone already.
  server.use(
    http.post(`${HOST}/api-token-deauth/`, () =>
      HttpResponse.json({}, {status: 401})
    )
  );
  await confirm('Discard and sign out');

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  await signedOutDataCleanedUp();
  expect(await Dexie.exists(name)).toBe(false);
  expect(errors.mock.calls).toEqual([
    [
      'Logout error:',
      new ApiRequestError('Logout failed', 401, 'Unauthorized'),
    ],
  ]);
});

describe('a queue that takes longer to send than sign-out waits', () => {
  let release = () => {};
  let sending: Promise<void> | undefined;
  beforeEach(() => {
    signOutTiming.flushWaitMs = 50;
    sending = undefined;
  });
  afterEach(async () => {
    signOutTiming.flushWaitMs = 5000;
    await act(async () => {
      release();
      if (sending !== undefined) {
        await expect(sending).rejects.toThrow('fetch failed');
      }
    });
  });

  /** A write whose sending hangs until the test ends. */
  async function queueHanging() {
    const hanging = new Promise<void>(resolve => {
      release = resolve;
    });
    server.use(
      http.post(`${API}/tags`, async () => {
        await hanging;
        return HttpResponse.error();
      })
    );
    const session = syncSession(TEST_USER);
    const flush = vi.spyOn(session.sync, 'flush');
    const index = flush.mock.calls.length;
    await act(async () => {
      await createTag(session, 'hanging');
      expect(flush).toHaveBeenCalledTimes(index + 1);
      sending = mockResult(flush, index);
    });
    return session.db.name;
  }

  it('warns while it is still being sent, and signs out keeping it', async () => {
    const {history, click} = await logOut();
    const name = await queueHanging();
    await click();

    expect(
      await screen.findByText(/1 change on this device has not reached/)
    ).toBeInTheDocument();
    await confirm('Sign out');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    await signedOutDataCleanedUp();
    expect(await hasQueuedWrites(name)).toBe(true);
  });

  it('warns once, however often the user asks, and not again after Cancel', async () => {
    await logOut();
    await queueHanging();
    const first = requestSignOut();
    // Asked again while the first is deciding: it joins the first.
    const second = requestSignOut();
    expect(second).toBe(first);
    expect(
      await screen.findByText('Changes not saved yet')
    ).toBeInTheDocument();
    act(() => cancelSignOut());
    await waitFor(() =>
      expect(screen.queryByText('Changes not saved yet')).toBeNull()
    );
    await act(() => first);

    expect(screen.queryByText('Changes not saved yet')).toBeNull();
    expect(store.loggedInUser).toBe(TEST_USER);
  });

  it("lets another user signed in meanwhile sign out, not joining the first's wait", async () => {
    const errors = vi.spyOn(console, 'error');
    signOutTiming.flushWaitMs = 2000;
    await queueHanging();
    const first = requestSignOut();
    // Another account signs in here while the first's queue is being sent.
    act(() => store.setLoggedInUser('alice'));

    // Its own sign-out: decided at once (alice has nothing queued).
    await requestSignOut();
    expect(store.loggedInUser).toBeNull();
    release();
    await first;
    const interrupted = expect.objectContaining({
      name: 'DatabaseClosedError',
      message: 'DatabaseClosedError Database has been closed',
    });
    await expect(sending).rejects.toEqual(interrupted);
    sending = undefined;
    expect(errors.mock.calls).toEqual([
      ['ERROR: could not read the queued writes:', interrupted],
    ]);
  });

  it('warns while it is still being sent, and signs out discarding it', async () => {
    const {history, click} = await logOut();
    const name = await queueHanging();
    await click();

    await screen.findByText('Changes not saved yet');
    await confirm('Discard and sign out');
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    await signedOutDataCleanedUp();
    expect(await Dexie.exists(name)).toBe(false);
  });
});

it('signs out all the same when the queued writes cannot be read', async () => {
  const {history, click} = await logOut();
  const errors = vi.spyOn(console, 'error');
  const unavailable = new Error('IndexedDB is unavailable');
  vi.spyOn(syncSession(TEST_USER).db.outbox, 'where').mockImplementation(() => {
    throw unavailable;
  });
  await click();

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
  expect(errors.mock.calls).toEqual([
    ['ERROR: could not read the queued writes:', unavailable],
  ]);
});
