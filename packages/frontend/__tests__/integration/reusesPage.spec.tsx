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
import {mockIntersectionObserver} from '../util/intersectionObserver';
import {server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';
beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
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

const seedReuses = async (count: number) => {
  for (let index = 0; index < count; index += 1)
    await apiClient.forVersion(1).reuseEntry('1', `scroll-copy-${index}`);
};

describe('infinite scrolling', () => {
  it.each(['/test/activity/reuses', '/test/entries/1'])(
    'loads near the bottom of %s, preserving rows and stopping at the end',
    async path => {
      const observer = mockIntersectionObserver();
      signInHere();
      await seedReuses(51);
      const pages = vi.spyOn(apiClientMethods, 'getEntryReuses');
      mount(path);
      const rows = within(await list()).getAllByRole('listitem');
      expect(rows).toHaveLength(50);
      await waitFor(() => expect(observer.observers.length).toBeGreaterThan(0));
      const first = observer.latest();
      act(() => first.intersect(false));
      expect(pages.mock.calls.filter(([, page]) => page > 1)).toHaveLength(0);

      act(() => first.intersect());
      await waitFor(async () =>
        expect(within(await list()).getAllByRole('listitem')).toHaveLength(51)
      );
      expect(within(await list()).getAllByRole('listitem')[0]).toBe(rows[0]);
      expect(screen.getByRole('status')).toHaveTextContent(
        'End of reuse history.'
      );
      expect(screen.queryByRole('button', {name: 'Show more'})).toBeNull();
      act(() => first.intersect());
      expect(
        pages.mock.calls.filter(([, page]) => page > 1).map(([, page]) => page)
      ).toEqual([2]);
      expect(first.disconnect).toHaveBeenCalled();
    }
  );

  it('coalesces repeated notifications and manual loading, then observes the next batch', async () => {
    const observer = mockIntersectionObserver();
    signInHere();
    await seedReuses(101);
    const engine = syncSession('test').sync;
    await engine.syncAll();
    const original = engine.entryReuses.bind(engine);
    const gate = Promise.withResolvers<void>();
    const reads = vi
      .spyOn(engine, 'entryReuses')
      .mockImplementation(async (id, page) => {
        if (page === 2) await gate.promise;
        return original(id, page);
      });
    mount();
    await list();
    await waitFor(() => expect(observer.observers).toHaveLength(1));
    const first = observer.latest();
    act(() => {
      first.intersect();
      first.intersect();
    });
    fireEvent.click(screen.getByRole('button', {name: 'Show more'}));
    expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
    expect(screen.getByRole('status')).toHaveTextContent('Loading the reuses…');
    expect(await list()).toHaveAttribute('aria-busy', 'true');
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(50);
    await act(async () => gate.resolve());
    await waitFor(async () =>
      expect(within(await list()).getAllByRole('listitem')).toHaveLength(100)
    );
    await waitFor(() => expect(observer.observers).toHaveLength(2));
    // A queued notification from the old footer cannot request page 2 again.
    act(() => first.intersect());
    expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
    act(() => observer.latest().intersect());
    await waitFor(async () =>
      expect(within(await list()).getAllByRole('listitem')).toHaveLength(101)
    );
    expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 2, 3]);
    expect(await list()).toHaveAttribute('aria-busy', 'false');
  });

  it('pauses on a failed page and retries it beside the retained rows', async () => {
    const observer = mockIntersectionObserver();
    signInHere();
    await seedReuses(51);
    const pages = vi.spyOn(apiClientMethods, 'getEntryReuses');
    mount();
    await list();
    await waitFor(() => expect(observer.observers).toHaveLength(1));
    const first = observer.latest();
    server.use(http.get(`${API}/entry_reuses`, () => HttpResponse.error()));
    act(() => first.intersect());
    const warning = await screen.findByRole('alert');
    expect(warning.closest('#entryReusePagination')).not.toBeNull();
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(50);
    act(() => {
      first.intersect();
      first.intersect();
    });
    expect(pages.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
    expect(screen.getByRole('button', {name: 'Show more'})).toBeDisabled();
    server.resetHandlers();
    fireEvent.click(within(warning).getByRole('button', {name: 'Retry'}));
    await waitFor(async () =>
      expect(within(await list()).getAllByRole('listitem')).toHaveLength(51)
    );
    expect(pages.mock.calls.map(([, page]) => page)).toEqual([1, 2, 2]);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('ignores notifications and an in-flight page after leaving history', async () => {
    const observer = mockIntersectionObserver();
    signInHere();
    await seedReuses(51);
    const engine = syncSession('test').sync;
    await engine.syncAll();
    const original = engine.entryReuses.bind(engine);
    const gate = Promise.withResolvers<void>();
    const reads = vi
      .spyOn(engine, 'entryReuses')
      .mockImplementation(async (id, page) => {
        if (page === 2) await gate.promise;
        return original(id, page);
      });
    const history = mount();
    await list();
    await waitFor(() => expect(observer.observers).toHaveLength(1));
    const first = observer.latest();
    act(() => first.intersect());
    act(() => history.push('/test?entries=all'));
    await waitFor(() =>
      expect(screen.queryByRole('list', {name: 'Reuses'})).toBeNull()
    );
    await act(async () => {
      gate.resolve();
      await reads.mock.results[1]?.value;
    });
    act(() => first.intersect());
    expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
    expect(screen.queryByRole('list', {name: 'Reuses'})).toBeNull();
  });

  it('prioritizes a queued reconnect refresh over further automatic pages', async () => {
    const observer = mockIntersectionObserver();
    signInHere();
    await seedReuses(101);
    const engine = syncSession('test').sync;
    await engine.syncAll();
    const original = engine.entryReuses.bind(engine);
    const gate = Promise.withResolvers<void>();
    const reads = vi
      .spyOn(engine, 'entryReuses')
      .mockImplementation(async (id, page) => {
        if (page === 2) await gate.promise;
        return original(id, page);
      });
    mount();
    await list();
    await waitFor(() => expect(observer.observers).toHaveLength(1));
    const first = observer.latest();
    act(() => {
      first.intersect();
      window.dispatchEvent(new Event('online'));
      window.dispatchEvent(new Event('online'));
    });
    expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 2]);
    await act(async () => gate.resolve());
    await waitFor(() => expect(reads).toHaveBeenCalledTimes(3));
    await waitFor(() =>
      expect(screen.getByRole('button', {name: 'Refresh'})).toBeEnabled()
    );
    expect(within(await list()).getAllByRole('listitem')).toHaveLength(50);
    act(() => first.intersect());
    expect(reads.mock.calls.map(([, page]) => page)).toEqual([1, 2, 1]);
  });

  it('discards the observer when the data version changes', async () => {
    const observer = mockIntersectionObserver();
    signInHere();
    await seedReuses(51);
    const pages = vi.spyOn(apiClientMethods, 'getEntryReuses');
    mount();
    await list();
    await waitFor(() => expect(observer.observers).toHaveLength(1));
    const first = observer.latest();
    server.use(http.get(`${API}/entry_reuses`, () => HttpResponse.error()));
    await act(() => syncSession('test').sync.adopt(2));
    await waitFor(() =>
      expect(screen.queryByRole('list', {name: 'Reuses'})).toBeNull()
    );
    act(() => first.intersect());
    expect(pages.mock.calls.filter(([, page]) => page > 1)).toHaveLength(0);
    expect(first.disconnect).toHaveBeenCalled();
  });
});

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
  await waitFor(() =>
    expect(screen.getByRole('button', {name: 'Refresh'})).toBeEnabled()
  );
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
