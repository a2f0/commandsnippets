/**
 * How often the entry list renders its rows: once each when the list is
 * read, and only the rows whose selection (or last copy) changes when
 * another entry is clicked, whose data a write changes (the list reads
 * every row again), or that a new entry's form opens next to (a long list
 * stays quick).
 */
import {act, fireEvent, screen} from '@testing-library/react';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {API, serveMockApi, server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {entry, seed} from '../util/storeFixtures';
import {renderAppAt} from '../util/TestAppRouter';

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

const COUNT = 40;
const WAIT = {timeout: 10_000};
vi.setConfig({testTimeout: 30_000});

serveMockApi();
afterEach(() => vi.restoreAllMocks());
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

/** All entries, `COUNT` of them, as the database holds them. */
async function showList(): Promise<void> {
  await seed(
    Array.from({length: COUNT}, (_, i) =>
      entry(String(i + 1), {subject: `subject ${i + 1}`})
    )
  );
  // The list as the database holds it: no sync changes it meanwhile.
  server.use(http.all(`${API}/*`, () => HttpResponse.error()));
  renders.rows = 0;
  renders.bodies = 0;
  renderAppAt('/test?entries=all');
  await screen.findByText(`subject ${COUNT}`, undefined, WAIT);
}

it('renders each row once when read, and only the changed rows on selection', async () => {
  await showList();
  expect(renders.rows).toBeGreaterThanOrEqual(COUNT);
  // (The first entry is selected once the list is read.)
  expect(renders.rows).toBeLessThanOrEqual(COUNT + 1);

  renders.rows = 0;
  renders.bodies = 0;
  await act(async () => {
    fireEvent.click(screen.getByText(`body-${COUNT / 2}`));
  });
  // The entry selected (and copied) before, and the one now: a render or
  // two each (selected and copied at once, then its reuse stored), none of
  // the other rows'.
  expect(renders.rows).toBeGreaterThan(0);
  expect(renders.rows).toBeLessThanOrEqual(3);
  expect(renders.bodies).toBeLessThanOrEqual(4);
});

it('renders only the entry reused when its reuse is stored', async () => {
  await showList();

  renders.rows = 0;
  renders.bodies = 0;
  await act(async () => {
    fireEvent.click(screen.getByText(`body-${COUNT / 2}`));
  });
  // The reuse is stored (its count shows): the list reads every entry
  // again, and renders again only the row it changed (and the click's).
  await screen.findByText('1×', undefined, WAIT);
  expect(renders.rows).toBeGreaterThan(0);
  expect(renders.rows).toBeLessThanOrEqual(4);
  expect(renders.bodies).toBeLessThanOrEqual(3);
});

it('renders only the row a new entry opens next to', async () => {
  await showList();

  renders.rows = 0;
  renders.bodies = 0;
  act(() => store.setEntryNew(`textEntry-${COUNT / 2}-top`));
  expect(
    document.getElementById(`textEntryNew-${COUNT / 2}-top`)
  ).toBeInTheDocument();
  // Only the row it opens next to.
  expect(renders.rows).toBeLessThanOrEqual(2);

  renders.rows = 0;
  renders.bodies = 0;
  act(() => store.setEntryNew(null));
  expect(
    document.getElementById(`textEntryNew-${COUNT / 2}-top`)
  ).not.toBeInTheDocument();
  // That row, and the one selected: the form leaves the list's mode.
  expect(renders.rows).toBeLessThanOrEqual(4);
});
