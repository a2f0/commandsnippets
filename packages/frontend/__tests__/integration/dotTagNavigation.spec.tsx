import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import invariant from 'invariant';
import {CookiesProvider} from 'react-cookie';
import {App} from '../../src/App';
import {apiClient} from '../../src/lib/api/apiClient';
import * as tagRename from '../../src/lib/data/tagRename';
import * as writes from '../../src/lib/data/writes';
import {createBrowserHistory} from '../../src/lib/router/history';
import {currentPath, currentRoute} from '../../src/lib/router/navigation';
import {Router} from '../../src/lib/router/Router';
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {serveMockApi} from '../util/msw';
import {signIn, store, TEST_USER} from '../util/signIn';

serveMockApi();
const browser = createBrowserHistory();
const paths: string[] = [];
const unlisten = browser.listen(() => {
  paths.push(browser.location.pathname + browser.location.search);
});
const COOKIE_OPTIONS = {path: '/'};

beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});
afterEach(async () => {
  // Stop new reads, then drain queued sync work before the shared account reset.
  cleanup();
  await act(async () => syncSession(TEST_USER).sync.flush());
  browser.replace('/');
});
afterAll(unlisten);

function byId(id: string): HTMLElement {
  const element = document.getElementById(id);
  invariant(element, `#${id} is rendered`);
  return element;
}

async function settleSync() {
  await act(async () => syncSession(TEST_USER).sync.syncAll());
}

/** Unlike memory history, this reads the URL after native normalization. */
async function renderBrowserAt(path: string) {
  browser.replace(path);
  paths.length = 0;
  const push = vi.spyOn(browser, 'push');
  const replace = vi.spyOn(browser, 'replace');
  await act(async () =>
    render(
      <Router history={browser}>
        <CookiesProvider defaultSetOptions={COOKIE_OPTIONS}>
          <App />
        </CookiesProvider>
      </Router>
    )
  );
  await settleSync();
  return {push, replace};
}

async function expectTag(name: string, id: string) {
  await waitFor(() =>
    expect(currentRoute()).toEqual({page: 'user', user: TEST_USER, tag: name})
  );
  await waitFor(() => expect(store.tagSelectedID).toBe(id));
  await settleSync();
  expect(window.location.pathname).toBe(browser.location.pathname);
}

async function saveRename(oldName: string, name: string) {
  fireEvent.contextMenu(screen.getByText(oldName));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit Tag'}));
  fireEvent.change(byId('tagEditTagName2'), {target: {value: name}});
  fireEvent.click(byId('tagEditSave2'));
}

async function expectStoredRename(name: string) {
  await waitFor(async () =>
    expect(
      (await syncSession(TEST_USER).db.tags.get([TEST_USER, '2']))?.attributes
        .name
    ).toBe(name)
  );
  await waitFor(() => expect(document.getElementById('tagEdit2')).toBeNull());
}

/** Hold the real write before persistence; finish includes the guarded read. */
function pauseRename() {
  const entered = Promise.withResolvers<void>();
  const resume = Promise.withResolvers<void>();
  const rename = writes.renameTag;
  const followUp = vi.spyOn(tagRename, 'isCurrentTagRename');
  const write = vi
    .spyOn(writes, 'renameTag')
    .mockImplementationOnce(async (...args) => {
      entered.resolve();
      await resume.promise;
      return rename(...args);
    });
  return {
    entered: entered.promise,
    finish: () =>
      act(async () => {
        resume.resolve();
        await Promise.all(write.mock.results.map(result => result.value));
        expect(followUp).toHaveBeenCalledTimes(1);
        await Promise.all(followUp.mock.results.map(result => result.value));
      }),
  };
}

it.each([
  ['.', '/test/test-tag-1'],
  ['..', '/test/test-tag-1'],
  ['.', '/test/test-tag-2?entries=all'],
  ['..', '/test/test-tag-2?entries=all'],
])(
  'does not follow saved dot tag %s after navigating to %s',
  async (name, path) => {
    const {push, replace} = await renderBrowserAt('/test/test-tag-2');
    await screen.findByText('test-tag-2');
    const pending = pauseRename();
    try {
      await saveRename('test-tag-2', name);
      await act(async () => pending.entered);
      fireEvent.click(byId('tagEditCancel2'));
      await act(async () => browser.push(path));
      await pending.finish();
      await expectStoredRename(name);
      await settleSync();

      expect(currentPath()).toBe(path);
      expect(window.location.pathname + window.location.search).toBe(path);
      expect(paths).toEqual([path]);
      expect(push).toHaveBeenCalledExactlyOnceWith(path);
      expect(replace).not.toHaveBeenCalled();
    } finally {
      await pending.finish();
    }
  }
);

it.each([
  ['.', 'all'],
  ['..', 'all'],
  ['.', 'untagged'],
  ['..', 'untagged'],
])('preserves dot tag %s with the entries=%s filter', async (name, filter) => {
  await apiClient.forVersion(1).updateTag('2', name);
  await apiClient.forVersion(1).createEntry('untagged control', 'body');
  const path = `/test/tags/~${name}?entries=${filter}`;
  const {push, replace} = await renderBrowserAt(path);
  await screen.findByText('untagged control');
  if (filter === 'all') {
    await screen.findByText('entry-1-subject');
  } else {
    expect(screen.queryByText('entry-1-subject')).not.toBeInTheDocument();
  }
  expect(currentRoute()).toEqual({page: 'user', user: TEST_USER, tag: name});
  expect(currentPath()).toBe(path);
  expect(paths).toEqual([]);
  expect(push).not.toHaveBeenCalled();
  expect(replace).not.toHaveBeenCalled();
});

it.each(['.', '..'])(
  'opens dot tag %s by click with one native push',
  async name => {
    await apiClient.forVersion(1).updateTag('2', name);
    const {push, replace} = await renderBrowserAt('/test/test-tag-1');
    fireEvent.click(await screen.findByText(name));
    await expectTag(name, '2');

    expect(currentPath()).toBe(`/test/tags/~${name}`);
    expect(paths).toEqual([`/test/tags/~${name}`]);
    expect(push).toHaveBeenCalledExactlyOnceWith(`/test/tags/~${name}`);
    expect(replace).not.toHaveBeenCalled();
  }
);

async function traverse(direction: 'back' | 'forward') {
  await act(async () => {
    const changed = new Promise<void>(resolve => {
      window.addEventListener('popstate', () => resolve(), {once: true});
    });
    window.history[direction]();
    await changed;
  });
}

it.each(['.', '..'])(
  'keeps dot tag %s through native Back and Forward',
  async name => {
    await apiClient.forVersion(1).updateTag('2', name);
    await renderBrowserAt('/test/test-tag-1');
    fireEvent.click(await screen.findByText(name));
    await expectTag(name, '2');

    await traverse('back');
    await expectTag('test-tag-1', '1');
    await traverse('forward');
    await expectTag(name, '2');

    expect(paths).toEqual([
      `/test/tags/~${name}`,
      '/test/test-tag-1',
      `/test/tags/~${name}`,
    ]);
  }
);

it.each(['.', '..'])('opens dot tag %s by keyboard Enter', async name => {
  await apiClient.forVersion(1).updateTag('2', name);
  const {push, replace} = await renderBrowserAt('/test/test-tag-1');
  await screen.findByText(name);
  fireEvent.click(screen.getByText('test-tag-1'));
  paths.length = 0;
  push.mockClear();
  fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
  fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});
  await expectTag(name, '2');

  expect(paths).toEqual([`/test/tags/~${name}`]);
  expect(push).toHaveBeenCalledExactlyOnceWith(`/test/tags/~${name}`);
  expect(replace).not.toHaveBeenCalled();
});

it.each(['.', '..'])(
  'automatically opens first dot tag %s once',
  async name => {
    await apiClient.forVersion(1).updateTag('1', name);
    const {push, replace} = await renderBrowserAt('/test');
    await expectTag(name, '1');

    expect(paths).toEqual([`/test/tags/~${name}`]);
    expect(push).toHaveBeenCalledExactlyOnceWith(`/test/tags/~${name}`);
    expect(replace).not.toHaveBeenCalled();
  }
);

it.each(['.', '..'])(
  'follows persisted selected-tag rename to %s by replacement',
  async name => {
    const {push, replace} = await renderBrowserAt('/test/test-tag-2');
    await screen.findByText('test-tag-2');
    const length = window.history.length;
    await saveRename('test-tag-2', name);
    await expectStoredRename(name);
    // Closing the editor precedes the guarded follow-up read and navigation.
    await expectTag(name, '2');

    expect(paths).toEqual([`/test/tags/~${name}`]);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledExactlyOnceWith(`/test/tags/~${name}`);
    expect(window.history.length).toBe(length);
  }
);

it.each(['.', '..'])(
  'opens the entry-detail link to dot tag %s',
  async name => {
    await apiClient.forVersion(1).updateTag('1', name);
    const {push, replace} = await renderBrowserAt('/test/entries/1');
    const link = (await screen.findByText(name)).closest('a');
    invariant(link, 'the entry detail tag is an anchor');
    await screen.findByText('Not reused yet.');
    expect(link).toHaveAttribute('href', `/test/tags/~${name}`);
    expect(new URL(link.href).pathname).toBe(`/test/tags/~${name}`);

    fireEvent.click(link);
    await expectTag(name, '1');

    expect(paths).toEqual([`/test/tags/~${name}`]);
    expect(push).toHaveBeenCalledExactlyOnceWith(`/test/tags/~${name}`);
    expect(replace).not.toHaveBeenCalled();
  }
);

it.each(['.', '..'])(
  'replaces the URL when renaming away from dot tag %s',
  async name => {
    await apiClient.forVersion(1).updateTag('2', name);
    const {push, replace} = await renderBrowserAt(`/test/tags/~${name}`);
    await expectTag(name, '2');
    const length = window.history.length;
    const renamed = 'renamed / literal%2e';
    await saveRename(name, renamed);
    await expectStoredRename(renamed);
    await expectTag(renamed, '2');

    expect(paths).toEqual(['/test/renamed%20%2F%20literal%252e']);
    expect(push).not.toHaveBeenCalled();
    expect(replace).toHaveBeenCalledExactlyOnceWith(
      '/test/renamed%20%2F%20literal%252e'
    );
    expect(window.history.length).toBe(length);
  }
);
