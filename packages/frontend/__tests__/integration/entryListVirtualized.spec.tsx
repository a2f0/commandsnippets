/**
 * A long entry list renders only the rows in view (and a few around them):
 * opening it stays quick however many entries there are. jsdom lays nothing
 * out, so each row reports a fixed height here.
 */
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {VIRTUALIZE_FROM} from '../../src/components/entries/EntryList';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {entry, seed} from '../util/storeFixtures';
import {TestAppRouter} from '../util/TestAppRouter';

const API = 'http://localhost:9001/api/v1';
const ROW_HEIGHT = 72;

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
  // Each row (a virtual item) is a row high, as the virtualizer measures.
  const height = Object.getOwnPropertyDescriptor(
    HTMLElement.prototype,
    'offsetHeight'
  );
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockImplementation(
    function (this: HTMLElement) {
      return this.dataset['index'] === undefined
        ? (height?.get?.call(this) ?? 0)
        : ROW_HEIGHT;
    }
  );
});

async function openWith(count: number) {
  await seed(
    Array.from({length: count}, (_, i) =>
      entry(String(i + 1), {subject: `subject ${i + 1}`})
    )
  );
  server.use(http.all(`${API}/*`, () => HttpResponse.error()));
  const history = createMemoryHistory();
  history.push('/test?entries=all');
  render(<TestAppRouter history={history} />);
  // (Seeding and reading hundreds of entries is slow alongside other suites.)
  await screen.findByText('subject 1', {}, {timeout: 10000});
}

const rendered = () => document.querySelectorAll('[role="entry"]').length;

// Each test lists hundreds of entries.
vi.setConfig({testTimeout: 30000});

it('renders only the rows in view of a long list', async () => {
  await openWith(500);
  const inView = Math.ceil(window.innerHeight / ROW_HEIGHT);
  await waitFor(() => expect(rendered()).toBeGreaterThanOrEqual(inView));
  expect(rendered()).toBeLessThan(inView + 30);
  expect(screen.queryByText('subject 500')).toBeNull();
});

it('renders every row of a shorter list', async () => {
  await openWith(VIRTUALIZE_FROM - 1);
  await waitFor(() => expect(rendered()).toBe(VIRTUALIZE_FROM - 1));
});

it('scrolls the window to the entry the arrow keys select', async () => {
  const scrolled = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
  // The page as high as its rows (the virtualizer scrolls no further).
  vi.spyOn(document.documentElement, 'scrollHeight', 'get').mockReturnValue(
    500 * ROW_HEIGHT
  );
  await openWith(500);
  await act(async () => {
    fireEvent.click(screen.getByText('body-1'));
  });
  for (let step = 0; step < 40; step += 1) {
    await act(async () => {
      fireEvent.keyDown(document, {key: 'ArrowDown', code: 'ArrowDown'});
    });
  }

  // The 41st entry listed is far below the window: scrolled to, past the
  // rows above.
  await waitFor(() => expect(scrolled).toHaveBeenCalled());
  const tops = scrolled.mock.calls.map(([options]) =>
    typeof options === 'object' && options !== null
      ? ((options as ScrollToOptions).top ?? 0)
      : 0
  );
  expect(Math.max(...tops)).toBeGreaterThan(30 * ROW_HEIGHT);
});
