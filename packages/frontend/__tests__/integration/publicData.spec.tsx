import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
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
import {apiClient} from '../../src/lib/api/apiClient';
import {setEntryPublic, setTagPublic} from '../../src/lib/data/writes';
import {useAppState} from '../../src/lib/state/appState';
import {publicSyncSession, syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {entry, tag} from '../util/storeFixtures';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});
const mount = (url: string) => {
  const history = createMemoryHistory();
  history.push(url);
  render(<TestAppRouter history={history} />);
  return history;
};
const publish = async () => {
  await apiClient.setTagPublic('1', true);
  await apiClient.setEntryPublic('1', true);
};

describe('public user pages', () => {
  it('keeps private rows and cursors isolated for an account named public', async () => {
    const full = syncSession('public');
    await full.db.tags.put({
      owner: 'public',
      ...tag('1', {name: 'private-tag'}),
    });
    await full.db.entries.put({
      owner: 'public',
      ...entry('1', {subject: 'private-entry'}),
    });
    await full.db.cursors.put({
      owner: 'public',
      key: 'entries',
      after: 'private-cursor',
    });
    const visitor = publicSyncSession('public');
    expect(visitor.db.name).not.toBe(full.db.name);
    expect(await visitor.db.tags.where('owner').equals('public').count()).toBe(
      0
    );
    expect(
      await visitor.db.entries.where('owner').equals('public').count()
    ).toBe(0);
    expect(await visitor.db.cursors.get(['public', 'entries'])).toBeUndefined();
  });
  it('lets an owner publish and hide tags and entries from their context menus', async () => {
    signIn();
    assignLoggedInCookie();
    mount('/test/test-tag-1');
    const subject = await screen.findByText('entry-1-subject');
    fireEvent.contextMenu(screen.getByText('test-tag-1'));
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Make public'}));
    const own = syncSession('test');
    await waitFor(async () =>
      expect((await own.db.tags.get(['test', '1']))?.attributes.is_public).toBe(
        true
      )
    );
    fireEvent.contextMenu(subject);
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Make public'}));
    await waitFor(async () =>
      expect(
        (await own.db.entries.get(['test', '1']))?.attributes.is_public
      ).toBe(true)
    );
    await own.sync.flush();
    const publicSession = publicSyncSession('test');
    await publicSession.sync.syncAll();
    expect(
      await publicSession.db.entries.where('owner').equals('test').count()
    ).toBe(1);
    fireEvent.contextMenu(subject);
    fireEvent.click(
      await screen.findByRole('menuitem', {name: 'Make private'})
    );
    await waitFor(async () =>
      expect(
        (await own.db.entries.get(['test', '1']))?.attributes.is_public
      ).toBe(false)
    );
    await own.sync.flush();
    await publicSession.sync.syncAll();
    expect(
      await publicSession.db.entries.where('owner').equals('test').count()
    ).toBe(0);
  });
  it('opens the same tag URL for a guest with filtered tags, entries, and read-only controls', async () => {
    await publish();
    const writes: string[] = [];
    server.events.on('request:start', ({request}) => {
      if (request.method !== 'GET') writes.push(request.method);
    });
    const history = mount('/test/test-tag-1');
    expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
    expect(history.location.pathname).toBe('/test/test-tag-1');
    expect(screen.queryByText('test-tag-2')).toBeNull();
    expect(screen.queryByText('entry-2-subject')).toBeNull();
    expect(screen.getByText('Read-only: test')).toBeInTheDocument();
    expect(screen.queryByRole('menu', {name: 'File'})).toBeNull();
    expect(document.getElementById('file-menu-new-entry')).toBeNull();
    expect(document.getElementById('file-menu-new-tag')).toBeNull();
    fireEvent.contextMenu(screen.getByText('entry-1-subject'));
    expect(
      await screen.findByRole('menuitem', {name: 'Copy'})
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('menuitem').map(item => item.textContent)
    ).toEqual(['Copy']);
    expect(writes).toEqual([]);
  });

  it('supports entries=all for a non-admin viewing someone else, with one copy of an entry in multiple public tags', async () => {
    await publish();
    await apiClient.tagEntry('2', '1');
    await apiClient.setTagPublic('2', true);
    signIn();
    assignLoggedInCookie();
    act(() => {
      useAppState.setState({loggedInUser: 'someone-else', isStaff: false});
    });
    const history = mount('/test?entries=all');
    expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
    expect(screen.getAllByText('entry-1-subject')).toHaveLength(1);
    expect(history.location.pathname).toBe('/test');
    expect(history.location.search).toBe('?entries=all');
    expect(screen.queryByText('entry-2-subject')).toBeNull();
    expect(store.loggedInUser).toBe('someone-else');
  });

  it('removes cached entries when hidden, and reloads historical rows when their tag becomes public', async () => {
    await publish();
    mount('/test?entries=all');
    const subject = 'entry-1-subject';
    expect(await screen.findByText(subject)).toBeInTheDocument();
    const session = publicSyncSession('test');
    await apiClient.setTagPublic('1', false);
    await act(async () => session.sync.syncAll());
    await waitFor(() => expect(screen.queryByText(subject)).toBeNull());
    expect(await session.db.entries.where('owner').equals('test').count()).toBe(
      0
    );
    await apiClient.setTagPublic('1', true);
    await act(async () => session.sync.syncAll());
    expect(await screen.findByText(subject)).toBeInTheDocument();
    await apiClient.setEntryPublic('1', false);
    await act(async () => session.sync.syncAll());
    await waitFor(() => expect(screen.queryByText(subject)).toBeNull());
  });

  it('isolates full and public data for the same owner, and rejects writes to public sessions', async () => {
    await publish();
    signIn();
    assignLoggedInCookie();
    const own = syncSession('test');
    const publicSession = publicSyncSession('test');
    await own.sync.syncAll();
    await publicSession.sync.syncAll();
    expect(publicSession.db.name).not.toBe(own.db.name);
    expect(
      await publicSession.db.entries.where('owner').equals('test').count()
    ).toBe(1);
    expect(
      await own.db.entries.where('owner').equals('test').count()
    ).toBeGreaterThan(1);
    await expect(setEntryPublic(publicSession, '1', true)).rejects.toThrow(
      'read-only'
    );
    await expect(setTagPublic(publicSession, '1', true)).rejects.toThrow(
      'read-only'
    );
    await setEntryPublic(own, '2', true);
    await own.sync.flush();
    await publicSession.sync.syncAll();
    expect(
      (await publicSession.db.entries.get(['test', '2']))?.attributes.is_public
    ).toBe(true);
    await setTagPublic(own, '1', false);
    await own.sync.flush();
    await publicSession.sync.syncAll();
    expect(
      await publicSession.db.entries.where('owner').equals('test').count()
    ).toBe(0);
    expect(
      await own.db.entries.where('owner').equals('test').count()
    ).toBeGreaterThan(1);
  });

  it('clears a revoked or missing public view, while leaving other owners cached', async () => {
    await publish();
    const session = publicSyncSession('test');
    await session.sync.syncAll();
    await session.db.tags.put({
      ...(await session.db.tags.get(['test', '1'])),
      owner: 'other',
      type: 'Tag',
      id: 'other',
      attributes: {
        name: 'other',
        entry_count: 0,
        order: 0,
        date_created: '2020-01-01',
        date_updated: '2020-01-01',
        date_last_used: null,
        is_deleted: false,
        is_public: true,
      },
      relationships: {user: {data: {type: 'User', id: '2'}}},
    });
    server.use(
      http.get('http://localhost:9001/api/v1/users/test', () =>
        HttpResponse.json(
          {errors: [{status: '404', code: 'not_found'}]},
          {status: 404}
        )
      )
    );
    await expect(session.sync.syncAll()).rejects.toThrow('unavailable');
    expect(await session.db.entries.where('owner').equals('test').count()).toBe(
      0
    );
    expect(await session.db.tags.where('owner').equals('other').count()).toBe(
      1
    );
  });

  it('restarts a page read when visibility changes mid-load, without retaining its old rows', async () => {
    await publish();
    let changed = false;
    server.use(
      http.get(
        'http://localhost:9001/api/v1/users/test/entries',
        async ({request}) => {
          if (
            new URL(request.url).searchParams.has('page[after]') &&
            !changed
          ) {
            changed = true;
            await apiClient.setEntryPublic('1', false);
            return HttpResponse.json(
              {errors: [{status: '409', code: 'view_changed'}]},
              {status: 409}
            );
          }
          return undefined;
        }
      )
    );
    const session = publicSyncSession('test');
    await session.sync.syncAll();
    expect(changed).toBe(true);
    expect(await session.db.entries.where('owner').equals('test').count()).toBe(
      0
    );
    expect(
      (await session.db.cursors.get(['test', 'entries']))?.initialLoad?.complete
    ).toBe(true);
  });
});
