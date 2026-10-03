import {CURSOR_START} from '@commandsnippets/api-shared/cursor';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {syncSession} from '../../src/lib/sync/session';
import {onePage} from '../../src/msw/documents';
import {afterOf, keysetPage} from '../../src/msw/keyset';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {entry} from '../util/storeFixtures';
import {TestAppRouter} from '../util/TestAppRouter';

// Hundreds of IndexedDB writes take longer alongside the full test suite.
const loadingWait = {timeout: 10000};
vi.setConfig({testTimeout: 30000});

beforeAll(() => server.listen({onUnhandledRequest: 'error'}));
afterAll(() => server.close());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

function renderApp() {
  const history = createMemoryHistory();
  history.push('/test?entries=all');
  return render(<TestAppRouter history={history} />);
}

const entries = Array.from({length: 205}, (_, index) =>
  entry(String(index + 1), {})
);

/** Pause the next entry page until the test releases it. */
function gate() {
  let release = () => {};
  const promise = new Promise<void>(resolve => {
    release = resolve;
  });
  return {promise, release};
}

it('keeps a legacy cursor background failure out of the first-load UI', async () => {
  const logged = vi.spyOn(console, 'error').mockImplementation(() => {});
  await syncSession('test').db.cursors.put({
    owner: 'test',
    key: 'entries',
    after: CURSOR_START,
  });
  server.use(
    http.get('*/api/v1/entries', () =>
      HttpResponse.json({errors: []}, {status: 500})
    )
  );
  renderApp();
  await waitFor(
    () =>
      expect(logged).toHaveBeenCalledWith(
        'ERROR: sync failed:',
        expect.any(Error)
      ),
    loadingWait
  );
  await act(async () => {
    await syncSession('test')
      .sync.syncAll()
      .catch(() => {});
  });
  expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  expect(
    screen.queryByText('Entry loading interrupted. Your saved pages are kept.')
  ).not.toBeInTheDocument();
});

it('offers retry when the first load fails before it creates a cursor', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  server.use(
    http.get('*/api/v1/user/', () =>
      HttpResponse.json({errors: []}, {status: 500})
    )
  );
  renderApp();
  await screen.findByText(
    'Entry loading interrupted. Your saved pages are kept.',
    {},
    loadingWait
  );
  expect(screen.getByRole('button', {name: 'Retry'})).toBeInTheDocument();
});

it('shows each page and loads all 205 entries without scrolling', async () => {
  const second = gate();
  const third = gate();
  const thirdRequested = gate();
  const sizes: string[] = [];
  server.use(
    http.get('*/api/v1/entries', async ({request}) => {
      const url = new URL(request.url);
      const after = afterOf(url);
      if (after === null) {
        return HttpResponse.json({
          ...onePage(request.url, entries.length),
          data: entries.slice(0, 1),
        });
      }
      sizes.push(url.searchParams.get('page[size]') ?? '');
      if (after.id === 100) {
        await second.promise;
      }
      if (after.id === 200) {
        thirdRequested.release();
        await third.promise;
      }
      return HttpResponse.json(keysetPage(url, entries, after));
    })
  );
  const app = renderApp();
  try {
    await screen.findByText('Loading entries: page 2 of 3', {}, loadingWait);
    expect(
      Number(screen.getByRole('progressbar').getAttribute('aria-valuenow'))
    ).toBeCloseTo(100 / 3);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '1 of 3 pages loaded'
    );
    await act(async () => {
      second.release();
      await thirdRequested.promise;
    });
    await screen.findByText('Loading entries: page 3 of 3', {}, loadingWait);
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuetext',
      '2 of 3 pages loaded'
    );
    await act(async () => {
      third.release();
    });
    await waitFor(
      () => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(),
      loadingWait
    );
    expect(await syncSession('test').db.entries.count()).toBe(205);
    expect(sizes).toEqual(['100', '100', '100']);
    // The last page's entries are already available to local search.
    act(() => store.setEntrySearchString('subject-205'));
    await screen.findByText('subject-205', {}, loadingWait);
    await act(async () => {
      await syncSession('test').sync.syncAll();
    });
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  } finally {
    second.release();
    third.release();
    app.unmount();
  }
});

it('shows an interrupted load and retries from the saved cursor', async () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  let failing = true;
  const cursors: string[] = [];
  server.use(
    http.get('*/api/v1/entries', ({request}) => {
      const url = new URL(request.url);
      const after = afterOf(url);
      if (after === null) {
        return HttpResponse.json({
          ...onePage(request.url, entries.length),
          data: entries.slice(0, 1),
        });
      }
      cursors.push(url.searchParams.get('page[after]') ?? '');
      if (failing && after.id === 100) {
        return HttpResponse.json({errors: []}, {status: 500});
      }
      return HttpResponse.json(keysetPage(url, entries, after));
    })
  );
  renderApp();
  await screen.findByText(
    'Entry loading interrupted. Your saved pages are kept.',
    {},
    loadingWait
  );
  await screen.findByText('1 of 3 pages loaded', {}, loadingWait);
  expect(await syncSession('test').db.entries.count()).toBe(100);
  const held = await syncSession('test').db.cursors.get(['test', 'entries']);
  invariant(held, 'the first page has a saved cursor');
  failing = false;
  fireEvent.click(screen.getByRole('button', {name: 'Retry'}));
  await waitFor(
    () => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(),
    loadingWait
  );
  expect(await syncSession('test').db.entries.count()).toBe(205);
  expect(cursors[2]).toBe(held.after);
  await act(async () => {
    await syncSession('test').sync.syncAll();
  });
});

it('loads entries with an indeterminate bar when the count is unavailable', async () => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(apiClient, 'getEntryCount').mockRejectedValue(
    new Error('count unavailable')
  );
  const first = gate();
  server.use(
    http.get('*/api/v1/entries', async ({request}) => {
      const url = new URL(request.url);
      const after = afterOf(url);
      invariant(after, 'the entry loader uses cursor pages');
      await first.promise;
      return HttpResponse.json(keysetPage(url, entries, after));
    })
  );
  const app = renderApp();
  try {
    await screen.findByText('Loading entries…', {}, loadingWait);
    expect(screen.getByRole('progressbar')).not.toHaveAttribute(
      'aria-valuenow'
    );
    await act(async () => {
      first.release();
    });
    await waitFor(
      () => expect(screen.queryByRole('progressbar')).not.toBeInTheDocument(),
      loadingWait
    );
    expect(await syncSession('test').db.entries.count()).toBe(205);
    await act(async () => {
      await syncSession('test').sync.syncAll();
    });
  } finally {
    first.release();
    app.unmount();
  }
});
