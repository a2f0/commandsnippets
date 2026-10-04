/** The tags' and entries' context menus: rendered only while open. */
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

function renderAt(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

/** The context menus in the document, by id. */
const menus = () =>
  [
    ...document.querySelectorAll(
      '[id^="tagsEntriesContextMenu-"], [id^="tagContextMenu-"]'
    ),
  ].map(menu => menu.id);

describe('Context menus', () => {
  it('are rendered only while open, for a row of either list', async () => {
    renderAt('/test/test-tag-1');
    const subject = await screen.findByText('entry-1-subject');
    expect(menus()).toEqual([]);

    fireEvent.contextMenu(subject);
    expect(await screen.findByRole('menuitem', {name: 'Copy'})).toBeVisible();
    expect(menus()).toEqual(['tagsEntriesContextMenu-1']);
    fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
    await waitFor(() => expect(menus()).toEqual([]));

    fireEvent.contextMenu(screen.getByText('test-tag-1'));
    expect(
      await screen.findByRole('menuitem', {name: 'Edit Tag'})
    ).toBeVisible();
    expect(menus()).toEqual(['tagContextMenu-1']);
    fireEvent.keyDown(screen.getByRole('menu'), {key: 'Escape'});
    await waitFor(() => expect(menus()).toEqual([]));
  });

  it("offer to make a tag private once it is public, from the tag's own state", async () => {
    renderAt('/test/test-tag-1');
    const tag = await screen.findByText('test-tag-1');
    const own = syncSession('test');

    fireEvent.contextMenu(tag);
    fireEvent.click(await screen.findByRole('menuitem', {name: 'Make public'}));
    await waitFor(async () =>
      expect((await own.db.tags.get(['test', '1']))?.attributes.is_public).toBe(
        true
      )
    );
    await waitFor(() => expect(menus()).toEqual([]));

    fireEvent.contextMenu(tag);
    fireEvent.click(
      await screen.findByRole('menuitem', {name: 'Make private'})
    );
    await waitFor(async () =>
      expect((await own.db.tags.get(['test', '1']))?.attributes.is_public).toBe(
        false
      )
    );
  });
});
