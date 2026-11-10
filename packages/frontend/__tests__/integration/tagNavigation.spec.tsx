import {tagCreateAttributesSchema} from '@commandsnippets/api-shared/requests';
import {fireEvent, screen, waitFor} from '@testing-library/react';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw/http';

import {apiClient} from '../../src/lib/api/apiClient';
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

it.each(['click', 'keyboard', 'first tag'])(
  'round-trips an encoded account when opening by %s',
  async method => {
    const user = 'oauth/github';
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
    const name = 'C#/literal%20';
    await apiClient.forVersion(1).updateTag('1', name);
    store.setLoggedInUser(user);
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
