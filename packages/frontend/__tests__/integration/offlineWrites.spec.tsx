/**
 * Writes made offline: shown at once, queued, and sent when the app is back
 * online (the entries page flushes the queue on the `online` event, and
 * before every sync).
 */
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {createEntry, createTag} from '../../src/lib/data/writes';
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

it("keeps an editor open on an entry made offline, with its text, when the API's id replaces its own", async () => {
  const history = createMemoryHistory();
  history.push('/test?entries=untagged');
  render(<TestAppRouter history={history} />);
  await screen.findByText('test-tag-1');
  const session = syncSession(TEST_USER);
  server.use(
    http.all(`${API}/*`, ({request}) =>
      request.method === 'GET' ? undefined : HttpResponse.error()
    )
  );
  await createEntry(session, 'draft-subject', 'body');
  await expect(session.sync.flush()).rejects.toThrow();

  // Editing it, not saved yet.
  fireEvent.contextMenu(await screen.findByText('draft-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  const subject = await screen.findByPlaceholderText('subject');
  fireEvent.change(subject, {target: {value: 'unsaved text'}});

  // Back online: the create is sent, and the entry gets the API's id.
  server.resetHandlers();
  await session.sync.flush();
  const stored = await session.db.entries
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.subject === 'draft-subject')
    .first();
  expect(isLocalId(stored?.id ?? 'local-')).toBe(false);

  // The same editor, now of the API's entry, its text kept.
  await waitFor(() =>
    expect(
      document.getElementById(`textEntryEdit${stored?.id ?? ''}`)
    ).not.toBeNull()
  );
  expect(screen.getByPlaceholderText('subject')).toHaveValue('unsaved text');
});

it("keeps an editor open on an entry when a tag made offline gets the entry's id", async () => {
  // Entry 5 and, once sent, tag 5: ids of different types can be alike.
  const {data: entry} = await apiClient.createEntry('five', 'body');
  const history = createMemoryHistory();
  history.push('/test?entries=untagged');
  render(<TestAppRouter history={history} />);
  const session = syncSession(TEST_USER);
  fireEvent.contextMenu(await screen.findByText('five'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  fireEvent.change(await screen.findByPlaceholderText('subject'), {
    target: {value: 'unsaved five'},
  });

  const tag = await createTag(session, 'made-here');
  await session.sync.flush();
  const sent = await session.db.tags
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.name === 'made-here')
    .first();
  expect(isLocalId(tag.id)).toBe(true);
  expect(sent?.id).toBe(entry.id);

  expect(screen.getByPlaceholderText('subject')).toHaveValue('unsaved five');
  expect(document.getElementById(`textEntryEdit${entry.id}`)).not.toBeNull();
});

it('keeps an editor open when a create whose answer was lost is retried after a sync', async () => {
  const history = createMemoryHistory();
  history.push('/test?entries=untagged');
  render(<TestAppRouter history={history} />);
  await screen.findByText('test-tag-1');
  const session = syncSession(TEST_USER);
  // The API makes the entry, but its answer never arrives.
  server.use(
    http.post(
      `${API}/entries`,
      async ({request}) => {
        await fetch(request.url, {
          method: 'POST',
          headers: request.headers,
          body: await request.text(),
        });
        return HttpResponse.error();
      },
      {once: true}
    )
  );
  const entry = await createEntry(session, 'lost-answer', 'body');
  await expect(session.sync.flush()).rejects.toThrow();
  // A sync brings the API's entry meanwhile.
  await session.sync.syncAll();

  const [shown] = await screen.findAllByText('lost-answer');
  fireEvent.contextMenu(shown ?? document.body);
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  fireEvent.change(await screen.findByPlaceholderText('subject'), {
    target: {value: 'still unsaved'},
  });

  // The retried create answers with the entry it made: one entry, the same
  // editor, its text kept.
  await session.sync.flush();
  const made = await session.db.entries
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.subject === 'lost-answer')
    .toArray();
  expect(made).toHaveLength(1);
  expect(made[0]?.localId).toBe(entry.id);
  await waitFor(() =>
    expect(
      document.getElementById(`textEntryEdit${made[0]?.id ?? ''}`)
    ).not.toBeNull()
  );
  expect(screen.getByPlaceholderText('subject')).toHaveValue('still unsaved');
});
