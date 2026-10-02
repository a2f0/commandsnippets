/**
 * Signing out with writes not sent yet (`lib/state/signOutWarning.ts`): the
 * queue is sent first; when writes are still unsent, the user is warned and
 * chooses to stay, to sign out keeping them on this device, or to discard
 * them.
 */
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {Dexie} from 'dexie';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {createTag} from '../../src/lib/data/writes';
import {signedOutDataCleanedUp} from '../../src/lib/state/appState';
import {
  cancelSignOut,
  confirmSignOut,
  requestSignOut,
  signOutTiming,
} from '../../src/lib/state/signOutWarning';
import {hasQueuedWrites, syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

const HOST = 'http://localhost:9001';
const API = `${HOST}/api/v1`;

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // The mock API announces each request; a flush that fails warns.
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

/** The API unreachable for writes (offline) until the handlers reset. */
const offline = () =>
  server.use(
    http.all(`${API}/*`, ({request}) =>
      request.method === 'GET' ? undefined : HttpResponse.error()
    )
  );

async function logOut() {
  const history = createMemoryHistory();
  history.push('/test/test-tag-1');
  render(<TestAppRouter history={history} />);
  await screen.findByText('test-tag-1');
  return {
    history,
    click: async () => {
      fireEvent.click(await screen.findByRole('menu', {name: 'File'}));
      await act(async () => {
        fireEvent.click(await screen.findByText('Logout'));
      });
    },
  };
}

/** A write queued while the API cannot be reached. */
async function queueOffline() {
  offline();
  const session = syncSession(TEST_USER);
  await createTag(session, 'unsent');
  await expect(session.sync.flush()).rejects.toThrow();
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
  await act(async () => {
    fireEvent.click(await screen.findByRole('button', {name: 'Sign out'}));
  });

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
  await signedOutDataCleanedUp();
  expect(await hasQueuedWrites(name)).toBe(true);
});

it('signs out discarding the unsent writes', async () => {
  const {history, click} = await logOut();
  const name = await queueOffline();
  await click();
  await act(async () => {
    fireEvent.click(
      await screen.findByRole('button', {name: 'Discard and sign out'})
    );
  });

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
  await signedOutDataCleanedUp();
  expect(await Dexie.exists(name)).toBe(false);
});

it("never acts on a warning left from another account's sign-out", async () => {
  const {click} = await logOut();
  await queueOffline();
  await click();
  expect(await screen.findByText('Changes not saved yet')).toBeInTheDocument();

  // Another account signs in here meanwhile (another tab's sign-in taken
  // up): the warning goes, and a confirmation left from it does nothing.
  act(() => store.setLoggedInUser('alice'));
  await waitFor(() =>
    expect(screen.queryByText('Changes not saved yet')).toBeNull()
  );
  const signOuts: string[] = [];
  server.events.on('request:start', ({request}) => {
    if (new URL(request.url).pathname === '/api-token-deauth/') {
      signOuts.push(request.url);
    }
  });
  await confirmSignOut({discardQueued: true});
  expect(signOuts).toEqual([]);
  server.events.removeAllListeners();
});

it('discards the unsent writes though the session ended as the user signed out', async () => {
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
  await act(async () => {
    fireEvent.click(
      await screen.findByRole('button', {name: 'Discard and sign out'})
    );
  });

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  await signedOutDataCleanedUp();
  expect(await Dexie.exists(name)).toBe(false);
});

describe('a queue that takes longer to send than sign-out waits', () => {
  let release = () => {};
  beforeEach(() => {
    signOutTiming.flushWaitMs = 50;
  });
  afterEach(() => {
    signOutTiming.flushWaitMs = 5000;
    release();
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
    await createTag(session, 'hanging');
    return session.db.name;
  }

  it('warns while it is still being sent, and signs out keeping it', async () => {
    const {history, click} = await logOut();
    const name = await queueHanging();
    await click();

    expect(
      await screen.findByText(/1 change on this device has not reached/)
    ).toBeInTheDocument();
    await act(async () => {
      fireEvent.click(await screen.findByRole('button', {name: 'Sign out'}));
    });
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    await signedOutDataCleanedUp();
    expect(await hasQueuedWrites(name)).toBe(true);
  });

  it('warns once, however often the user asks, and not again after Cancel', async () => {
    await logOut();
    await queueHanging();
    const first = requestSignOut();
    await new Promise(resolve => setTimeout(resolve, 25));
    const second = requestSignOut();
    expect(
      await screen.findByText('Changes not saved yet')
    ).toBeInTheDocument();
    act(() => cancelSignOut());
    await waitFor(() =>
      expect(screen.queryByText('Changes not saved yet')).toBeNull()
    );
    await Promise.all([first, second]);
    // Past the second request's wait too: it never comes back.
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(screen.queryByText('Changes not saved yet')).toBeNull();
    expect(store.loggedInUser).toBe(TEST_USER);
  });

  it("lets another user signed in meanwhile sign out, not joining the first's wait", async () => {
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
  });

  it('warns while it is still being sent, and signs out discarding it', async () => {
    const {history, click} = await logOut();
    const name = await queueHanging();
    await click();

    await screen.findByText('Changes not saved yet');
    await act(async () => {
      fireEvent.click(
        await screen.findByRole('button', {name: 'Discard and sign out'})
      );
    });
    await waitFor(() => expect(history.location.pathname).toBe('/'));
    await signedOutDataCleanedUp();
    expect(await Dexie.exists(name)).toBe(false);
  });
});

it('signs out all the same when the queued writes cannot be read', async () => {
  const {history, click} = await logOut();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(syncSession(TEST_USER).db.outbox, 'where').mockImplementation(() => {
    throw new Error('IndexedDB is unavailable');
  });
  await click();

  await waitFor(() => expect(history.location.pathname).toBe('/'));
  expect(store.loggedInUser).toBeNull();
});
