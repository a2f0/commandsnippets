import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {syncSession} from '../../src/lib/sync/session';
import {apiClientMethods} from '../util/apiClientMethods';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';
beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
const signInHere = () => {
  signIn();
  assignLoggedInCookie();
};
const mount = (path = '/test/activity/reuses') => {
  const history = createMemoryHistory({initialEntries: [path]});
  render(<TestAppRouter history={history} />);
  return history;
};
const list = () => screen.findByRole('list', {name: 'Reuses'});

it('opens from View, combines entries newest first, and returns after drilling into an entry', async () => {
  signInHere();
  await apiClient.forVersion(1).reuseEntry('1', 'first');
  await apiClient.forVersion(1).reuseEntry('1', 'second');
  await apiClient.forVersion(1).reuseEntry('2', 'third');
  const history = mount('/test?entries=all');
  fireEvent.click(await screen.findByRole('menu', {name: 'View'}));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'All reuses'}));
  expect(
    await screen.findByRole('heading', {name: 'All reuses'})
  ).toBeInTheDocument();
  await waitFor(async () =>
    expect(
      within(await list())
        .getAllByRole('link')
        .map(link => link.textContent)
    ).toEqual(['entry-2-subject', 'entry-1-subject', 'entry-1-subject'])
  );
  expect(screen.getByText('3 reuses')).toBeInTheDocument();
  fireEvent.click(
    within(await list()).getByRole('link', {name: 'entry-2-subject'})
  );
  expect(
    await screen.findByRole('heading', {name: 'entry-2-subject'})
  ).toBeInTheDocument();
  const back = screen.getByRole('link', {name: 'Back to all reuses'});
  expect(back).toHaveAttribute('href', '/test/activity/reuses');
  fireEvent.click(back);
  expect(history.location.pathname).toBe('/test/activity/reuses');
  expect(within(await list()).getAllByRole('listitem')).toHaveLength(3);
  fireEvent.click(screen.getByRole('link', {name: 'Back to entries'}));
  expect(`${history.location.pathname}${history.location.search}`).toBe(
    '/test?entries=all'
  );
});

it('opens all reuses from the individual history', async () => {
  signInHere();
  mount('/test/entries/1');
  fireEvent.click(await screen.findByRole('link', {name: 'All reuses'}));
  expect(
    await screen.findByRole('heading', {name: 'All reuses'})
  ).toBeInTheDocument();
  expect(
    await screen.findByText(
      'No reuses yet. Copy an entry to start your history.'
    )
  ).toBeInTheDocument();
});

it('shows the whole history in manageable batches', async () => {
  signInHere();
  for (let index = 0; index < 51; index += 1)
    await apiClient.forVersion(1).reuseEntry('1', `copy-${index}`);
  const pages = vi.spyOn(apiClientMethods, 'getEntryReuses');
  mount();
  expect(within(await list()).getAllByRole('listitem')).toHaveLength(50);
  expect(screen.getByText('51 reuses')).toBeInTheDocument();
  expect(pages.mock.calls.map(([, page]) => page)).toEqual([1]);
  fireEvent.click(screen.getByRole('button', {name: 'Show more'}));
  await waitFor(async () =>
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(51)
  );
  expect(pages.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
  expect(screen.queryByRole('button', {name: 'Show more'})).toBeNull();
});

it('retries initial errors and refreshes copies from another device', async () => {
  signInHere();
  server.use(http.get(`${API}/entry_reuses`, () => HttpResponse.error()));
  mount();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The reuses could not be read.'
  );
  server.resetHandlers();
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await screen.findByText(
    'No reuses yet. Copy an entry to start your history.'
  );
  await apiClient.forVersion(1).reuseEntry('2', 'another-device');
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  expect(within(await list()).getAllByRole('listitem')).toHaveLength(1);
});

it('offers Retry when the first sync cannot determine a data version offline', async () => {
  signInHere();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(http.all(`${API}/*`, () => HttpResponse.error()));
  mount();
  const warning = await screen.findByRole('alert');
  expect(warning).toHaveTextContent('The reuses could not be read.');
  expect(screen.queryByText('Loading the reuses…')).toBeNull();
  server.resetHandlers();
  fireEvent.click(within(warning).getByRole('button', {name: 'Retry'}));
  expect(
    await screen.findByText(
      'No reuses yet. Copy an entry to start your history.'
    )
  ).toBeInTheDocument();
});

it('retries the next page without dropping loaded rows or duplicating a shifted row', async () => {
  signInHere();
  for (let index = 0; index < 51; index += 1)
    await apiClient.forVersion(1).reuseEntry('1', `copy-${index}`);
  const pages = vi.spyOn(apiClientMethods, 'getEntryReuses');
  mount();
  await list();
  // A new copy shifts the last row of page one onto page two.
  await apiClient.forVersion(1).reuseEntry('2', 'between-pages');
  server.use(http.get(`${API}/entry_reuses`, () => HttpResponse.error()));
  fireEvent.click(screen.getByRole('button', {name: 'Show more'}));
  await screen.findByRole('alert');
  expect(within(await list()).getAllByRole('listitem')).toHaveLength(50);
  server.resetHandlers();
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await waitFor(async () =>
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(51)
  );
  expect(pages.mock.calls.map(([, page]) => page)).toEqual([1, 2, 2]);
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  await waitFor(async () =>
    expect(
      within(await list()).getByRole('link', {name: 'entry-2-subject'})
    ).toBeInTheDocument()
  );
  expect(within(await list()).getAllByRole('listitem')).toHaveLength(50);
  expect(pages.mock.calls.map(([, page]) => page)).toEqual([1, 2, 2, 1]);
});

it('coalesces reconnects during a read and refreshes only the newest page', async () => {
  signInHere();
  const engine = syncSession('test').sync;
  await engine.syncAll();
  const original = engine.entryReuses.bind(engine);
  const gate = Promise.withResolvers<void>();
  const reads = vi
    .spyOn(engine, 'entryReuses')
    .mockImplementationOnce(async (...args) => {
      await gate.promise;
      return original(...args);
    });
  mount();
  await waitFor(() => expect(reads).toHaveBeenCalledTimes(1));
  act(() => {
    window.dispatchEvent(new Event('online'));
    window.dispatchEvent(new Event('online'));
  });
  expect(reads).toHaveBeenCalledTimes(1);
  await apiClient.forVersion(1).reuseEntry('2', 'while-reading');
  await act(async () => {
    gate.resolve();
    await gate.promise;
  });
  await waitFor(() => expect(reads).toHaveBeenCalledTimes(2));
  expect(
    within(await list()).getByRole('link', {name: 'entry-2-subject'})
  ).toBeInTheDocument();
  expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 1]);
});

it('keeps the last history visible on refresh failure and offers Retry', async () => {
  signInHere();
  await apiClient.forVersion(1).reuseEntry('1', 'first');
  mount();
  await list();
  server.use(http.get(`${API}/entry_reuses`, () => HttpResponse.error()));
  fireEvent.click(screen.getByRole('button', {name: 'Refresh'}));
  await screen.findByRole('alert');
  expect(within(await list()).getAllByRole('listitem')).toHaveLength(1);
  server.resetHandlers();
  await apiClient.forVersion(1).reuseEntry('2', 'second');
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await waitFor(async () =>
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(2)
  );
});

it('retains a reuse of a deleted entry without linking to a missing page', async () => {
  signInHere();
  await apiClient.forVersion(1).reuseEntry('1', 'first');
  await apiClient.forVersion(1).deleteEntry('1');
  mount();
  expect(
    within(await list()).getByText('Unavailable entry #1')
  ).toBeInTheDocument();
  expect(within(await list()).queryByRole('link')).toBeNull();
});

it('clears displayed history when a different data version is adopted', async () => {
  signInHere();
  await apiClient.forVersion(1).reuseEntry('1', 'old-version');
  mount();
  await list();
  server.use(http.get(`${API}/entry_reuses`, () => HttpResponse.error()));
  await act(() => syncSession('test').sync.adopt(2));
  await waitFor(() =>
    expect(screen.queryByRole('list', {name: 'Reuses'})).toBeNull()
  );
});

it.each(['guest', 'other user', 'staff'])(
  'does not request private history as %s',
  async viewer => {
    if (viewer !== 'guest') signInHere();
    if (viewer === 'staff') store.setIsStaff(true);
    const requests = vi.fn();
    server.use(
      http.get(`${API}/entry_reuses`, () => {
        requests();
        return HttpResponse.error();
      })
    );
    const history = mount(
      viewer === 'guest' ? '/test/activity/reuses' : '/alice/activity/reuses'
    );
    await waitFor(() =>
      expect(history.location.pathname).not.toContain('/activity/reuses')
    );
    expect(screen.queryByRole('heading', {name: 'All reuses'})).toBeNull();
    fireEvent.click(screen.getByRole('menu', {name: 'View'}));
    expect(screen.queryByRole('menuitem', {name: 'All reuses'})).toBeNull();
    expect(requests).not.toHaveBeenCalled();
  }
);

it('signs out and removes the private history when the cookie is cleared', async () => {
  signIn();
  assignLoggedInCookie('');
  mount();
  await waitFor(() => expect(store.loggedInUser).toBeNull());
  expect(screen.queryByRole('heading', {name: 'All reuses'})).toBeNull();
});
