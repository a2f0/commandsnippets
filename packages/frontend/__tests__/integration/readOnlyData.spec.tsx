/**
 * Staff read another user's data on that user's page (`/:user`): synced
 * through the admin API into the signed-in user's IndexedDB database under
 * that user's name, shown read-only (a badge in the menu bar; nothing on the
 * page creates, edits or reorders), and never written.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {vi} from 'vitest';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  // The mock API announces each request.
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

function renderAt(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
  return history;
}

/** The element `#id`, which must be rendered. */
function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

/** Every write the page sends from now on. */
function writesSent(): string[] {
  const writes: string[] = [];
  server.events.on('request:start', ({request}) => {
    if (request.method !== 'GET') {
      writes.push(`${request.method} ${request.url}`);
    }
  });
  return writes;
}

describe("Another user's page", () => {
  it("shows staff that user's data, marked read-only", async () => {
    act(() => store.setIsStaff(true));
    const writes = writesSent();

    const history = renderAt('/alice');

    expect(await screen.findByText('alices-tag')).toBeInTheDocument();
    expect(await screen.findByText('alices-entry')).toBeInTheDocument();
    // The first tag opens, on alice's page.
    await waitFor(() =>
      expect(history.location.pathname).toBe('/alice/alices-tag')
    );
    expect(byId('readOnlyBadge')).toHaveTextContent('Read-only: alice');
    // None of the signed-in user's own data.
    expect(screen.queryByText('test-tag-1')).toBeNull();

    // Stored under alice's name, beside (never among) the user's own.
    const {db} = syncSession(TEST_USER);
    await waitFor(async () =>
      expect(await db.tags.get(['alice', '70'])).toBeDefined()
    );
    expect(await db.tags.get([TEST_USER, '70'])).toBeUndefined();
    expect(writes).toEqual([]);
  });

  it('offers nothing that creates, edits or reorders', async () => {
    act(() => store.setIsStaff(true));
    const writes = writesSent();
    renderAt('/alice/alices-tag');
    const entry = await screen.findByText('alices-entry');

    // File: no New Tag or New Entry, and no Export Backup (of their own
    // data, which would read as alice's).
    fireEvent.click(screen.getByRole('menu', {name: 'File'}));
    expect(await screen.findByText('Logout')).toBeInTheDocument();
    expect(document.getElementById('file-menu-new-tag')).toBeNull();
    expect(document.getElementById('file-menu-new-entry')).toBeNull();
    expect(document.getElementById('file-menu-export-backup')).toBeNull();
    fireEvent.keyDown(screen.getByText('Logout'), {key: 'Escape'});

    // No context menu on a tag, the tag list, or the entry list.
    fireEvent.contextMenu(screen.getByText('alices-tag'));
    expect(document.getElementById('tagContextMenu-70')).toBeNull();
    expect(document.getElementById('tagListContextMenu')).toBeNull();
    expect(document.getElementById('entryListContextMenu')).toBeNull();

    // An entry's offers Copy alone.
    const row = entry.closest('[role="entry"]');
    invariant(row instanceof HTMLElement, 'the entry is rendered');
    fireEvent.contextMenu(row);
    const menu = byId('tagsEntriesContextMenu-71');
    await waitFor(() =>
      expect(
        within(menu)
          .getAllByRole('menuitem', {hidden: true})
          .map(item => item.textContent)
      ).toEqual(['Copy'])
    );

    // No drag handles, to reorder or tag with.
    for (const container of document.querySelectorAll<HTMLElement>(
      '[role="entryDragHandleContainer"], [role="tag"]'
    )) {
      fireEvent.mouseEnter(container);
    }
    for (const handle of document.querySelectorAll<HTMLElement>(
      '[role="entryDragHandle"], [role="tagDragHandle"]'
    )) {
      expect(handle).not.toBeVisible();
    }
    expect(writes).toEqual([]);
  });

  it('keeps non-staff on the requested public page', async () => {
    act(() => store.setIsStaff(false));

    const history = renderAt('/alice');

    await waitFor(() => expect(history.location.pathname).toBe('/alice'));
    expect(await screen.findByText('Read-only: alice')).toBeInTheDocument();
    expect(screen.queryByText('test-tag-1')).toBeNull();
    expect(screen.queryByText('alices-entry')).toBeNull();
  });

  it("leaves staff's own page as it was: editable, with no badge", async () => {
    act(() => store.setIsStaff(true));

    renderAt(`/${TEST_USER}`);

    expect(await screen.findByText('test-tag-1')).toBeInTheDocument();
    expect(document.getElementById('readOnlyBadge')).toBeNull();
    expect(document.getElementById('tagListContextMenu')).not.toBeNull();
    fireEvent.click(screen.getByRole('menu', {name: 'File'}));
    expect(
      await waitFor(() => byId('file-menu-new-entry'))
    ).toBeInTheDocument();
  });
});
