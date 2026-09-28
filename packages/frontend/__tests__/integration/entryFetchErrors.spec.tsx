import {act, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {type MockInstance, vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {store} from '../util/loggedInStore';
import {server} from '../util/msw';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

// The rejections nothing handled while a test ran.
let unhandled: unknown[] = [];
const collectUnhandled = (reason: unknown) => {
  unhandled.push(reason);
};
let consoleError: MockInstance<typeof console.error>;

beforeEach(() => {
  unhandled = [];
  process.on('unhandledRejection', collectUnhandled);
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  process.off('unhandledRejection', collectUnhandled);
  vi.restoreAllMocks();
  store.setEntrySearchString('');
});

/** Give Node time to report a rejection left unhandled. */
function settle() {
  return new Promise(resolve => setTimeout(resolve, 50));
}

function renderApp(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

function failEntryFetches() {
  server.use(
    http.get('*/api/v1/entries', () =>
      HttpResponse.json({errors: []}, {status: 500})
    )
  );
}

const fetchError = ['Failed to fetch entries:', expect.any(Error)];

describe('Entry list fetches', () => {
  it('drops an all-entries request a newer search aborted, silently', async () => {
    renderApp('/test?entries=all');
    await screen.findByText('entry-1-subject');
    const getEntries = vi.spyOn(apiClient, 'getEntries');

    act(() => {
      store.setEntrySearchString('entry');
    });
    await waitFor(() => expect(getEntries).toHaveBeenCalledTimes(2));
    await settle();

    const signals = getEntries.mock.calls.map(([params]) => params.signal);
    expect(signals.some(signal => signal?.aborted)).toBe(true);
    expect(unhandled).toEqual([]);
    expect(consoleError).not.toHaveBeenCalledWith(...fetchError);
    // The newer request's entries are listed.
    expect(screen.getAllByRole('entry')).toHaveLength(4);
  });

  it.each([
    ['the all-entries list', '/test?entries=all'],
    ['the untagged list', '/test?entries=untagged'],
    ['a tag list', '/test/test-tag-1'],
  ])('logs a failed fetch for %s', async (_list, route) => {
    failEntryFetches();
    renderApp(route);

    await waitFor(() =>
      expect(consoleError).toHaveBeenCalledWith(...fetchError)
    );
    await settle();

    expect(unhandled).toEqual([]);
  });
});
