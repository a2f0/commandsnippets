import {tagCreateAttributesSchema} from '@commandsnippets/api-shared/requests';
import {act, cleanup, fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';

import {apiClient} from '../../src/lib/api/apiClient';
import {UserMismatchError} from '../../src/lib/api/errors';
import {routeOf} from '../../src/lib/router/route';
import {syncSession} from '../../src/lib/sync/session';
import {testUser} from '../../src/msw/fixtures';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi, server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});
afterEach(() => cleanup());

/** Change accounts only after fixture writes, preserving the mock write guard. */
function signInAs(user: string): void {
  server.use(
    http.get('*/api/v1/user/', () =>
      HttpResponse.json({
        data: {
          ...testUser,
          attributes: {...testUser.attributes, username: user},
        },
      })
    )
  );
  store.setLoggedInUser(user);
}

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

it.each(['C#', 'a/b', 'a%20b'])(
  'keeps the selected tag reachable after renaming it to %s',
  async name => {
    const {history} = await renderAppAt('/test/test-tag-1', {act: true});
    await screen.findByText('entry-1-subject');
    expect(tagCreateAttributesSchema.safeParse({name}).success).toBe(true);
    fireEvent.contextMenu(screen.getByText('test-tag-1'));
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit Tag'}));
    fireEvent.change(byId('tagEditTagName1'), {target: {value: name}});
    fireEvent.click(byId('tagEditSave1'));
    await waitFor(async () =>
      expect(
        (await syncSession(TEST_USER).db.tags.get([TEST_USER, '1']))?.attributes
          .name
      ).toBe(name)
    );
    await waitFor(() => expect(document.getElementById('tagEdit1')).toBeNull());

    expect(routeOf(history.location.pathname)).toEqual({
      page: 'user',
      user: TEST_USER,
      tag: name,
    });
  }
);

it.each(['click', 'keyboard', 'first tag'])(
  'encodes tag names when opening by %s',
  async method => {
    const name = 'C#/literal%20';
    await apiClient.forVersion(1).updateTag('1', name);
    const {history} = await renderAppAt(
      method === 'first tag' ? '/test' : '/test/test-tag-2',
      {act: true}
    );
    const label = await screen.findByText(name);
    if (method === 'click') fireEvent.click(label);
    if (method === 'keyboard') {
      fireEvent.click(screen.getByText('test-tag-2'));
      fireEvent.keyDown(document, {key: 'ArrowUp', code: 'ArrowUp'});
      fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
    }
    await waitFor(() =>
      expect(routeOf(history.location.pathname)).toEqual({
        page: 'user',
        user: TEST_USER,
        tag: name,
      })
    );
    expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
  }
);

it.each(['test', 'oauth/github'])(
  'opens an encoded tag from an entry detail page for %s',
  async user => {
    const warnings = vi.spyOn(console, 'warn');
    const name = 'C#/literal%20';
    await apiClient.forVersion(1).updateTag('1', name);
    signInAs(user);
    const root = `/${encodeURIComponent(user)}`;
    const {history} = await renderAppAt(`${root}/entries/1`, {act: true});
    const link = (await screen.findByText(name)).closest('a');
    invariant(link, 'the entry detail tag is a link');
    // Detail history sends an expected-user header even on its GET. The
    // encoded-account fixture deliberately does not relax the mock guard.
    if (user === TEST_USER) {
      await screen.findByText('Not reused yet.');
      expect(warnings).not.toHaveBeenCalled();
    } else {
      await screen.findByText('The reuses could not be read.');
      expect(warnings.mock.calls).toEqual([
        [
          'WARNING: the reuses could not be read:',
          new UserMismatchError('Failed to fetch entry', user),
        ],
      ]);
    }
    await act(async () => syncSession(user).sync.syncAll());

    fireEvent.click(link);

    expect(link).toHaveAttribute('href', `${root}/${encodeURIComponent(name)}`);
    expect(routeOf(history.location.pathname)).toEqual({
      page: 'user',
      user,
      tag: name,
    });
    expect(history.location.search).toBe('');
    expect(history.location.hash).toBe('');
    expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
    await act(async () => syncSession(user).sync.syncAll());
  }
);

it.each(['click', 'keyboard', 'first tag'])(
  'round-trips an encoded account when opening by %s',
  async method => {
    const user = 'oauth/github';
    const name = 'C#/literal%20';
    await apiClient.forVersion(1).updateTag('1', name);
    signInAs(user);
    const root = `/${encodeURIComponent(user)}`;
    const {history} = await renderAppAt(
      method === 'first tag' ? root : `${root}/test-tag-2`,
      {act: true}
    );
    if (method !== 'first tag') {
      const label = await screen.findByText(name);
      if (method === 'click') fireEvent.click(label);
      if (method === 'keyboard') {
        fireEvent.click(screen.getByText('test-tag-2'));
        fireEvent.keyDown(document, {key: 'ArrowUp', code: 'ArrowUp'});
        fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
      }
    }
    await waitFor(() =>
      expect(routeOf(history.location.pathname)).toEqual({
        page: 'user',
        user,
        tag: name,
      })
    );
    expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
  }
);
