/**
 * Writes made offline: shown at once, queued, and sent when the app is back
 * online (the entries page flushes the queue on the `online` event, and
 * before every sync).
 */
import {CURSOR_START} from '@commandsnippets/api-shared/cursor';
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';
import {type MockResult, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {ApiRequestError} from '../../src/lib/api/errors';
import {createEntry, createTag} from '../../src/lib/data/writes';
import {signedOutDataCleanedUp} from '../../src/lib/state/appState';
import {isLocalId} from '../../src/lib/sync/outbox';
import * as sessions from '../../src/lib/sync/session';
import {syncSession} from '../../src/lib/sync/session';
import * as syncReads from '../../src/lib/sync/sync';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {mockResult} from '../util/mockResult';
import {
  API,
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

async function renderEntries(path: string) {
  await act(async () => renderAppAt(path));
  await screen.findByText('test-tag-1');
  await pageSyncs.finish();
}

it('shows a write made offline at once, and sends it once back online', async () => {
  await renderEntries('/test/test-tag-1');
  await screen.findByText('entry-1-subject');
  const session = syncSession(TEST_USER);
  const posted = recordRequests(({method}, path) =>
    method === 'POST' ? path : undefined
  );
  offlineForWrites();

  const entry = await act(() =>
    createEntry(session, 'offline-subject', 'body', '1')
  );

  expect(await screen.findByText('offline-subject')).toBeInTheDocument();
  await act(async () => {
    await expect(session.sync.flush()).rejects.toThrow();
  });
  expect(await session.db.outbox.count()).toBe(2);

  server.resetHandlers();
  const reconnect = vi.spyOn(session.sync, 'flush');
  const reconnectIndex = reconnect.mock.calls.length;
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    expect(reconnect).toHaveBeenCalledTimes(reconnectIndex + 1);
    await mockResult(reconnect, reconnectIndex);
  });
  await pageSyncs.finish();

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
  const errors = vi.spyOn(console, 'error');
  await renderEntries('/test/test-tag-1');
  await screen.findByText('entry-1-subject');
  const session = syncSession(TEST_USER);
  offlineForWrites();
  await act(() => createEntry(session, 'kept-subject', 'body'));
  await act(async () => {
    await expect(session.sync.flush()).rejects.toThrow();
  });

  // The session expires: the API answers 401, which signs the user out.
  server.use(
    http.get(`${API}/user/`, () => HttpResponse.json({}, {status: 401}))
  );
  const reconnect = vi.spyOn(session.sync, 'flush');
  const reconnectIndex = reconnect.mock.calls.length;
  await act(async () => {
    window.dispatchEvent(new Event('online'));
    expect(reconnect).toHaveBeenCalledTimes(reconnectIndex + 1);
    await expect(mockResult(reconnect, reconnectIndex)).rejects.toThrow(
      'fetch failed'
    );
  });
  const expired = new ApiRequestError(
    'Failed to fetch user',
    401,
    'Unauthorized'
  );
  await pageSyncs.finish([expired]);
  await waitFor(() => expect(store.loggedInUser).toBeNull());
  await act(() => signedOutDataCleanedUp());

  // Their database stays, queue and all; signing in again sends it.
  server.resetHandlers();
  await act(async () => signIn());
  const again = syncSession(TEST_USER);
  await act(async () => expect(await again.db.outbox.count()).toBe(1));
  await act(() => again.sync.flush());
  await pageSyncs.finish();
  expect(await again.db.outbox.count()).toBe(0);
  const stored = await again.db.entries
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.subject === 'kept-subject')
    .first();
  expect(isLocalId(stored?.id ?? 'local-')).toBe(false);
  expect(errors.mock.calls).toEqual([['ERROR: sync failed:', expired]]);
});

it("keeps an editor open on an entry made offline, with its text, when the API's id replaces its own", async () => {
  await renderEntries('/test?entries=untagged');
  await screen.findByText('test-tag-1');
  const session = syncSession(TEST_USER);
  offlineForWrites();
  await act(() => createEntry(session, 'draft-subject', 'body'));
  await act(async () => {
    await expect(session.sync.flush()).rejects.toThrow();
  });

  // Editing it, not saved yet.
  fireEvent.contextMenu(await screen.findByText('draft-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  const subject = await screen.findByPlaceholderText('subject');
  fireEvent.change(subject, {target: {value: 'unsaved text'}});

  // Back online: the create is sent, and the entry gets the API's id.
  server.resetHandlers();
  await act(() => session.sync.flush());
  const stored = await act(() =>
    session.db.entries
      .where('owner')
      .equals(TEST_USER)
      .filter(row => row.attributes.subject === 'draft-subject')
      .first()
  );
  expect(isLocalId(stored?.id ?? 'local-')).toBe(false);

  // The same editor, now of the API's entry, its text kept.
  await waitFor(() =>
    expect(
      document.getElementById(`textEntryEdit${stored?.id ?? ''}`)
    ).not.toBeNull()
  );
  expect(screen.getByPlaceholderText('subject')).toHaveValue('unsaved text');
});

it("keeps a new entry's form opened next to an entry made offline, with its text, when the API's id replaces its own", async () => {
  await renderEntries('/test?entries=untagged');
  await screen.findByText('test-tag-1');
  const session = syncSession(TEST_USER);
  offlineForWrites();
  await act(() => createEntry(session, 'anchor', 'body'));
  await act(async () => {
    await expect(session.sync.flush()).rejects.toThrow();
  });

  // A new entry's form, above it, not saved yet.
  fireEvent.contextMenu(await screen.findByText('anchor'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'New Entry'}));
  fireEvent.change(await screen.findByPlaceholderText('subject'), {
    target: {value: 'unsaved new'},
  });

  server.resetHandlers();
  await act(() => session.sync.flush());
  const stored = await act(() =>
    session.db.entries
      .where('owner')
      .equals(TEST_USER)
      .filter(row => row.attributes.subject === 'anchor')
      .first()
  );
  invariant(stored && !isLocalId(stored.id), 'the API id should replace it');

  // The same form, above the API's entry, its text kept.
  await waitFor(() =>
    expect(
      document.getElementById(`textEntryNew-${stored.id}-top`)
    ).not.toBeNull()
  );
  expect(screen.getByPlaceholderText('subject')).toHaveValue('unsaved new');
});

it("keeps an editor open on an entry when a tag made offline gets the entry's id", async () => {
  const errors = vi.spyOn(console, 'error');
  // Entry 5 and, once sent, tag 5: ids of different types can be alike.
  const {data: entry} = await apiClient
    .forVersion(1)
    .createEntry('five', 'body');
  await renderEntries('/test?entries=untagged');
  const session = syncSession(TEST_USER);
  fireEvent.contextMenu(await screen.findByText('five'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  fireEvent.change(await screen.findByPlaceholderText('subject'), {
    target: {value: 'unsaved five'},
  });

  const tag = await act(() => createTag(session, 'made-here'));
  await act(() => session.sync.flush());
  const sent = await act(() =>
    session.db.tags
      .where('owner')
      .equals(TEST_USER)
      .filter(row => row.attributes.name === 'made-here')
      .first()
  );
  expect(isLocalId(tag.id)).toBe(true);
  expect(sent?.id).toBe(entry.id);

  expect(screen.getByPlaceholderText('subject')).toHaveValue('unsaved five');
  expect(document.getElementById(`textEntryEdit${entry.id}`)).not.toBeNull();
  expect(errors).not.toHaveBeenCalled();
});

it('adopts the entry a create whose answer was lost made, when a sync brings it', async () => {
  await renderEntries('/test?entries=untagged');
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
  const entry = await act(() => createEntry(session, 'lost-answer', 'body'));
  await act(async () => {
    await expect(session.sync.flush()).rejects.toThrow();
  });

  // Editing it, not saved yet.
  fireEvent.contextMenu(await screen.findByText('lost-answer'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  fireEvent.change(await screen.findByPlaceholderText('subject'), {
    target: {value: 'still unsaved'},
  });

  // A sync brings the API's entry: it is the one shown (once), the create is
  // not queued any more, and the same editor is open on it, its text kept.
  await act(() => session.sync.syncAll());
  expect(await session.db.outbox.count()).toBe(0);
  const made = await session.db.entries
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.attributes.subject === 'lost-answer')
    .toArray();
  expect(made).toHaveLength(1);
  expect(made[0]?.localId).toBe(entry.id);
  expect(isLocalId(made[0]?.id ?? 'local-')).toBe(false);
  await waitFor(() =>
    expect(
      document.getElementById(`textEntryEdit${made[0]?.id ?? ''}`)
    ).not.toBeNull()
  );
  expect(screen.getByPlaceholderText('subject')).toHaveValue('still unsaved');
});

it('adopts the tag a create whose answer was lost made, renamed since', async () => {
  await renderEntries('/test?entries=untagged');
  await screen.findByText('test-tag-1');
  const session = syncSession(TEST_USER);
  server.use(
    http.post(
      `${API}/tags`,
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
  const tag = await act(() => createTag(session, 'lost-tag'));
  await act(async () => {
    await expect(session.sync.flush()).rejects.toThrow();
  });
  // Another device renames the tag the API made.
  const listed = await apiClient.getTagsAfter(CURSOR_START);
  const made = listed.data.find(row => row.attributes.client_id === tag.id);
  invariant(made, 'the API should have made the tag');
  await apiClient.forVersion(1).updateTag(made.id, 'renamed-tag');
  // This device's clock runs ahead: its copy reads as newer than the API's.
  await act(() =>
    session.db.tags.update([TEST_USER, tag.id], {
      'attributes.date_updated': '2999-01-01T00:00:00.000000',
    })
  );

  await act(() => session.sync.syncAll());
  expect(await session.db.outbox.count()).toBe(0);
  const stored = await session.db.tags
    .where('owner')
    .equals(TEST_USER)
    .filter(row => row.localId === tag.id || row.id === tag.id)
    .toArray();
  expect(stored).toEqual([
    expect.objectContaining({
      id: made.id,
      attributes: expect.objectContaining({name: 'renamed-tag'}),
    }),
  ]);
  expect(await screen.findByText('renamed-tag')).toBeInTheDocument();
  expect(screen.queryByText('lost-tag')).toBeNull();

  // Sending the queue again makes nothing more.
  const posted = recordRequests(({method}, path) =>
    method === 'POST' ? path : undefined
  );
  await act(() => session.sync.flush());
  expect(posted).toEqual([]);
});
