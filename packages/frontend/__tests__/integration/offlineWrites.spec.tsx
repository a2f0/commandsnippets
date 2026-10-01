/**
 * Writes made offline: shown at once, queued, and sent when the app is back
 * online (the entries page flushes the queue on the `online` event, and
 * before every sync).
 */
import {act, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {createEntry} from '../../src/lib/data/writes';
import {isLocalId} from '../../src/lib/sync/outbox';
import {syncSession} from '../../src/lib/sync/session';
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

it('shows a write made offline at once, and sends it once back online', async () => {
  const history = createMemoryHistory();
  history.push('/test/test-tag-1');
  render(<TestAppRouter history={history} />);
  await screen.findByText('entry-1-subject');
  const session = syncSession(TEST_USER);
  const posted: string[] = [];
  server.events.on('request:start', ({request}) => {
    if (request.method === 'POST') {
      posted.push(new URL(request.url).pathname);
    }
  });
  server.use(
    http.all(`${API}/*`, ({request}) =>
      request.method === 'GET' ? undefined : HttpResponse.error()
    )
  );

  const entry = await createEntry(session, 'offline-subject', 'body', '1');

  expect(await screen.findByText('offline-subject')).toBeInTheDocument();
  await expect(session.sync.flush()).rejects.toThrow();
  expect(await session.db.outbox.count()).toBe(2);

  server.resetHandlers();
  act(() => {
    window.dispatchEvent(new Event('online'));
  });

  await waitFor(async () => expect(await session.db.outbox.count()).toBe(0));
  expect(posted).toEqual(
    expect.arrayContaining(['/api/v1/entries', '/api/v1/tags_entries'])
  );
  // Still listed, now as the API's entry.
  expect(screen.getByText('offline-subject')).toBeInTheDocument();
  const stored = await session.db.entries
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.subject === 'offline-subject')
    .first();
  expect(isLocalId(entry.id)).toBe(true);
  expect(isLocalId(stored?.id ?? 'local-')).toBe(false);
  server.events.removeAllListeners();
});

it('keeps writes queued when the session expires, and sends them at the next sign-in', async () => {
  const history = createMemoryHistory();
  history.push('/test/test-tag-1');
  render(<TestAppRouter history={history} />);
  await screen.findByText('entry-1-subject');
  const session = syncSession(TEST_USER);
  server.use(
    http.all(`${API}/*`, ({request}) =>
      request.method === 'GET' ? undefined : HttpResponse.error()
    )
  );
  await createEntry(session, 'kept-subject', 'body');
  await expect(session.sync.flush()).rejects.toThrow();

  // The session expires: the API answers 401, which signs the user out.
  server.use(
    http.get(`${API}/user/`, () => HttpResponse.json({}, {status: 401}))
  );
  act(() => {
    window.dispatchEvent(new Event('online'));
  });
  await waitFor(() => expect(store.loggedInUser).toBeNull());

  // Their database stays, queue and all; signing in again sends it.
  server.resetHandlers();
  act(() => signIn());
  const again = syncSession(TEST_USER);
  expect(await again.db.outbox.count()).toBe(1);
  await again.sync.flush();
  expect(await again.db.outbox.count()).toBe(0);
  const stored = await again.db.entries
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.subject === 'kept-subject')
    .first();
  expect(isLocalId(stored?.id ?? 'local-')).toBe(false);
});
