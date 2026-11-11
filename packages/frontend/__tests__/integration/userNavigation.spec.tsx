import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import {HttpResponse, http} from 'msw/http';

import {routeOf} from '../../src/lib/router/route';
import {syncSession} from '../../src/lib/sync/session';
import {testUser} from '../../src/msw/fixtures';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {recordRequests, serveMockApi, server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});
afterEach(() => {
  cleanup();
  window.history.replaceState({}, '', '/');
  window.sessionStorage.removeItem('oauth_state');
});

/** Read-only navigation fixture; the mock API's write guard stays intact. */
function currentUser(username: string, isStaff = false): void {
  server.use(
    http.get('*/api/v1/user/', () =>
      HttpResponse.json({
        data: {
          ...testUser,
          attributes: {
            ...testUser.attributes,
            username,
            is_staff: isStaff,
          },
        },
      })
    )
  );
}

describe.each(['test', 'oauth/github', 'literal%2F?x#y'])(
  'account navigation for %s',
  user => {
    it.each(['github', 'google'])(
      'opens the account after a %s OAuth callback',
      async provider => {
        currentUser(user);
        store.setLoggedInUser(null);
        server.use(
          http.post(
            `*/api/v1/${provider}-login/`,
            () => new HttpResponse(null, {status: 204})
          )
        );
        const logins = recordRequests((request, path) =>
          request.method === 'POST' && path === `/api/v1/${provider}-login/`
            ? path
            : undefined
        );
        const query = new URLSearchParams({
          code: 'routing-test-code',
          state: 'routing-test-state',
          scope: 'https://www.googleapis.com/auth/userinfo.email',
        });
        const callback = `/oauth/${provider}?${query}`;
        window.history.pushState({}, '', callback);
        window.sessionStorage.setItem('oauth_state', 'routing-test-state');
        const {history} = await renderAppAt(callback, {act: true});

        await waitFor(() => expect(store.loggedInUser).toBe(user));
        expect(routeOf(history.location.pathname)).toMatchObject({
          page: 'user',
          user,
        });
        expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
        await act(async () => syncSession(user).sync.syncAll());
        expect(history.location.pathname).toBe(
          `/${encodeURIComponent(user)}/test-tag-1`
        );
        expect(history.location.search).toBe('');
        expect(history.location.hash).toBe('');
        expect(history.index).toBe(3);
        expect(logins).toHaveLength(1);
        expect(window.sessionStorage.getItem('oauth_state')).toBeNull();
      }
    );

    it.each([true, false])(
      'returns from the admin page with staff=%s',
      async isStaff => {
        currentUser(user, isStaff);
        store.setLoggedInUser(user);
        const {history} = await renderAppAt('/admin', {act: true});
        if (isStaff) {
          await screen.findByRole('table', {name: 'Users'});
        } else {
          await screen.findByText('You do not have access to this page.');
        }
        const link = screen.getByRole(isStaff ? 'tab' : 'link', {
          name: isStaff ? 'User' : 'Entries',
        });
        const previousIndex = history.index;

        fireEvent.click(link);

        expect(routeOf(history.location.pathname)).toMatchObject({
          page: 'user',
          user,
        });
        expect(link).toHaveAttribute('href', `/${encodeURIComponent(user)}`);
        expect(history.index).toBe(previousIndex + 1);
        expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
        await act(async () => syncSession(user).sync.syncAll());
        if (isStaff) {
          const selectedPath = history.location.pathname;
          const selectedIndex = history.index;
          fireEvent.click(screen.getByRole('tab', {name: 'User'}));
          expect(history.location.pathname).toBe(selectedPath);
          expect(history.index).toBe(selectedIndex);
        }
      }
    );

    it('opens the signed-in account from the application root', async () => {
      currentUser(user);
      store.setLoggedInUser(user);
      const {history} = await renderAppAt('/?old=1#old', {act: true});

      expect(routeOf(history.location.pathname)).toMatchObject({
        page: 'user',
        user,
      });
      expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
      await act(async () => syncSession(user).sync.syncAll());
      expect(history.location.pathname).toBe(
        `/${encodeURIComponent(user)}/test-tag-1`
      );
      expect(history.location.search).toBe('');
      expect(history.location.hash).toBe('');
      // Root -> account -> first tag remains two pushes, not replacements.
      expect(history.index).toBe(3);
    });

    it.each([
      ['all', 'All Entries'],
      ['untagged', 'Untagged Entries'],
    ])('opens the %s filter from the Entries menu', async (filter, label) => {
      currentUser(user);
      store.setLoggedInUser(user);
      const root = `/${encodeURIComponent(user)}`;
      const {history} = await renderAppAt(`${root}/test-tag-1?old=1`, {
        act: true,
      });
      await screen.findByText('entry-1-subject');
      await act(async () => syncSession(user).sync.syncAll());
      const previousIndex = history.index;

      fireEvent.click(screen.getByRole('menu', {name: 'Entries'}));
      fireEvent.click(await screen.findByRole('menuitem', {name: label}));

      expect(history.location.pathname).toBe(root);
      expect(routeOf(history.location.pathname)).toEqual({page: 'user', user});
      expect(history.location.search).toBe(`?entries=${filter}`);
      expect(history.location.hash).toBe('');
      expect(history.index).toBe(previousIndex + 1);
      await waitFor(() => expect(screen.queryByRole('menuitem')).toBeNull());
      expect(screen.getByText('test-tag-1')).toBeInTheDocument();
      if (filter === 'all') {
        expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
      } else {
        await waitFor(() =>
          expect(screen.queryByText('entry-1-subject')).toBeNull()
        );
      }
    });
  }
);

it.each(['another-user', 'oauth/github', 'literal%2F?x#y'])(
  'replaces the previous account route when switching to %s',
  async user => {
    const {history} = await renderAppAt('/test/test-tag-1?entries=all#old', {
      act: true,
    });
    await screen.findByText('entry-1-subject');
    await act(async () => syncSession('test').sync.syncAll());
    const navigations: {action: string; path: string}[] = [];
    const unlisten = history.listen(({action, location}) =>
      navigations.push({
        action,
        path: location.pathname + location.search + location.hash,
      })
    );

    currentUser(user);
    act(() => store.setLoggedInUser(user));

    expect(navigations[0]).toEqual({
      action: 'REPLACE',
      path: `/${encodeURIComponent(user)}`,
    });
    expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
    await act(async () => syncSession(user).sync.syncAll());
    expect(routeOf(history.location.pathname)).toEqual({
      page: 'user',
      user,
      tag: 'test-tag-1',
    });
    expect(history.location.search).toBe('');
    expect(history.location.hash).toBe('');
    unlisten();
  }
);
