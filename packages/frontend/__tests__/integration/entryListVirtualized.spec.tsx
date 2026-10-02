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
import {syncSession} from '../../src/lib/sync/session';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {entry, seed, testUser} from '../util/storeFixtures';
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

/**
 * The window scrolled to `y`. jsdom lays nothing out, so each element is at
 * the top of the page: in the window, `y` above it.
 */
function scrollable() {
  let y = 0;
  vi.spyOn(window, 'scrollY', 'get').mockImplementation(() => y);
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(
    () => ({
      x: 0,
      y: -y,
      top: -y,
      left: 0,
      bottom: -y,
      right: 0,
      width: 0,
      height: 0,
      toJSON: () => ({}),
    })
  );
  return async (to: number) => {
    y = to;
    await act(async () => {
      window.dispatchEvent(new Event('scroll'));
    });
  };
}

/** Open the editor on `subject`'s entry, and change its subject to `to`. */
async function edit(subject: string, to: string) {
  fireEvent.contextMenu(await screen.findByText(subject));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Edit'}));
  fireEvent.change(await screen.findByDisplayValue(subject), {
    target: {value: to},
  });
}

/** The indexes of the rows rendered, apart from the one holding `form`. */
const otherRows = (form: HTMLElement) => {
  const held = form.closest('[data-index]');
  return Array.from(document.querySelectorAll<HTMLElement>('[data-index]'))
    .filter(row => row !== held)
    .map(row => Number(row.dataset['index']));
};

/** The index of the row holding `form`. */
const rowOf = (form: HTMLElement) =>
  Number(form.closest<HTMLElement>('[data-index]')?.dataset['index']);

it('keeps an editor open, its text and all, while the window scrolls away and back', async () => {
  const scrollTo = scrollable();
  await openWith(500);
  await edit('subject 1', 'draft');
  const row = rowOf(screen.getByDisplayValue('draft'));
  expect(row).toBeLessThan(10);

  // Far below it: its row stays rendered, out of view, as the rows around
  // it do not.
  await scrollTo(400 * ROW_HEIGHT);
  await waitFor(() =>
    expect(
      Math.min(...otherRows(screen.getByDisplayValue('draft')))
    ).toBeGreaterThan(300)
  );
  expect(rowOf(screen.getByDisplayValue('draft'))).toBe(row);

  await scrollTo(0);
  await waitFor(() =>
    expect(otherRows(screen.getByDisplayValue('draft'))).toContain(row + 1)
  );
  expect(rowOf(screen.getByDisplayValue('draft'))).toBe(row);
});

it("keeps a new entry's form open, its text and all, while the window scrolls away", async () => {
  const scrollTo = scrollable();
  await openWith(500);
  fireEvent.contextMenu(await screen.findByText('subject 1'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'New Entry'}));
  fireEvent.change(await screen.findByPlaceholderText('subject'), {
    target: {value: 'unsaved new'},
  });

  await scrollTo(400 * ROW_HEIGHT);
  await waitFor(() =>
    expect(
      Math.min(...otherRows(screen.getByPlaceholderText('subject')))
    ).toBeGreaterThan(300)
  );
  expect(screen.getByPlaceholderText('subject')).toHaveValue('unsaved new');
});

it('keeps an editor open, its text and all, when the list gets too short to virtualize', async () => {
  await openWith(VIRTUALIZE_FROM);
  await edit('subject 1', 'draft');

  // One entry fewer (as a sync removes it): every row rendered (the one
  // edited as its editor), its editor the same.
  const {db} = syncSession(testUser.attributes.username);
  await act(async () => {
    await db.entries.delete([
      testUser.attributes.username,
      String(VIRTUALIZE_FROM),
    ]);
  });
  await waitFor(() =>
    expect(document.querySelectorAll('[data-index]')).toHaveLength(
      VIRTUALIZE_FROM - 1
    )
  );
  expect(screen.getByDisplayValue('draft')).toBeInTheDocument();
});
