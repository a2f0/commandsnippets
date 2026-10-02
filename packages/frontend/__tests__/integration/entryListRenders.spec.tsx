/**
 * How often the entry list renders its rows: once each when the list is
 * read, and only the rows whose selection changes when another entry is
 * selected (a long list stays quick).
 */
import {act, fireEvent, render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {HttpResponse, http} from 'msw';
import React from 'react';
import {vi} from 'vitest';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {entry, seed} from '../util/storeFixtures';
import {TestAppRouter} from '../util/TestAppRouter';

const renders = vi.hoisted(() => ({rows: 0, bodies: 0}));

// The rows and their bodies, counted: each wrapper is memoized as the
// component it wraps, so it renders exactly when that would.
vi.mock('../../src/components/entries/Entry', async importOriginal => {
  const actual =
    await importOriginal<typeof import('../../src/components/entries/Entry')>();
  const Counted = React.memo(
    (props: React.ComponentProps<typeof actual.Entry>) => {
      renders.rows += 1;
      return <actual.Entry {...props} />;
    }
  );
  return {...actual, Entry: Counted};
});
vi.mock('../../src/components/entries/EntryBody', async importOriginal => {
  const actual =
    await importOriginal<
      typeof import('../../src/components/entries/EntryBody')
    >();
  const Counted = React.memo(
    (props: React.ComponentProps<typeof actual.MemoizedEntryBody>) => {
      renders.bodies += 1;
      return <actual.MemoizedEntryBody {...props} />;
    }
  );
  return {...actual, MemoizedEntryBody: Counted};
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
  // (The first entry is selected once the list is read.)
  expect(renders.rows).toBeLessThanOrEqual(COUNT + 1);

  renders.rows = 0;
  renders.bodies = 0;
  await act(async () => {
    fireEvent.click(screen.getByText(`body-${COUNT / 2}`));
  });
  // The entry selected before, and the one selected now.
  expect(renders.bodies).toBeLessThanOrEqual(2);
  expect(renders.rows).toBeLessThanOrEqual(2);
});
