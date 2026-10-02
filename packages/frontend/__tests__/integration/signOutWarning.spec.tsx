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
import {hasQueuedWrites, syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';

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
