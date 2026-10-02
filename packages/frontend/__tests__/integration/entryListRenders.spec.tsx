/**
 * How often the entry list renders its rows: once each when the list is
 * read, and only the rows whose selection (or last copy) changes when
 * another entry is clicked (a long list stays quick).
 */
import {act, fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import {vi} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {entry, seed} from '../util/storeFixtures';
import {TestAppRouter} from '../util/TestAppRouter';

const renders = vi.hoisted(() => ({rows: 0, bodies: 0}));

/** Whether the hook calling this was called by a component in `file`. */
const calledIn = (file: string) =>
  (new Error().stack ?? '').split('\n')[3]?.includes(`/entries/${file}:`) ??
  false;

// The rows' and their bodies' renders, every one (from their props or
// their subscriptions): each calls these hooks once a render.
vi.mock('../../src/lib/data/hooks', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/lib/data/hooks')>();
  return {
    ...actual,
    useSession: () => {
      if (calledIn('Entry.tsx')) {
        renders.rows += 1;
      }
      return actual.useSession();
    },
  };
});
vi.mock('../../src/lib/state/appState', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/lib/state/appState')>();
  return {
    ...actual,
    useAppConfig: () => {
      if (calledIn('EntryBody.tsx')) {
        renders.bodies += 1;
      }
      return actual.useAppConfig();
    },
  };
});

const API = 'http://localhost:9001/api/v1';
const COUNT = 40;

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
  // Clicking an entry's body copies it.
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
});

it('renders each row once when read, and only the changed rows on selection', async () => {
  await seed(
    Array.from({length: COUNT}, (_, i) =>
      entry(String(i + 1), {subject: `subject ${i + 1}`})
    )
  );
  // The list as the database holds it: no sync changes it meanwhile.
  server.use(http.all(`${API}/*`, () => HttpResponse.error()));
  renders.rows = 0;
  renders.bodies = 0;
  const history = createMemoryHistory();
  history.push('/test?entries=all');
  render(<TestAppRouter history={history} />);
  await screen.findByText(`subject ${COUNT}`);
  expect(renders.rows).toBeGreaterThanOrEqual(COUNT);
  // (The first entry is selected once the list is read.)
  expect(renders.rows).toBeLessThanOrEqual(COUNT + 1);

  renders.rows = 0;
  renders.bodies = 0;
  await act(async () => {
    fireEvent.click(screen.getByText(`body-${COUNT / 2}`));
  });
  // The entry selected (and copied) before, and the one now: a few renders
  // each (selected, copied), none of the other rows'.
  expect(renders.rows).toBeGreaterThan(0);
  expect(renders.rows).toBeLessThanOrEqual(6);
  expect(renders.bodies).toBeLessThanOrEqual(4);
});
