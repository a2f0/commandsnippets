/**
 * An entry's reuse count (`reused_count`) shows beside its subject for its
 * owner, and not for an entry never reused. It is private: public pages get
 * 0 from the API, so a guest sees none.
 */
import {render, screen} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {publicSyncSession} from '../../src/lib/sync/session';
import {setRuntimeEntriesOverride} from '../../src/msw/handlers';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Entry 1 reused three times, entry 2 once, the others never.
  const reused: Record<string, number> = {'1': 3, '2': 1};
  setRuntimeEntriesOverride({
    ...entriesResponse,
    data: entriesResponse.data.map(entry => ({
      ...entry,
      attributes: {...entry.attributes, reused_count: reused[entry.id] ?? 0},
    })),
  });
});

const mount = (url: string) => {
  const history = createMemoryHistory();
  history.push(url);
  render(<TestAppRouter history={history} />);
};

const reuseCounts = () => screen.queryAllByTitle(/^Reused /);

it("shows the owner each entry's reuse count beside its subject", async () => {
  signIn();
  assignLoggedInCookie();
  mount('/test/test-tag-1');

  expect(await screen.findByTitle('Reused 3 times')).toHaveTextContent('3×');
  expect(screen.getByTitle('Reused 1 time')).toHaveTextContent('1×');
  expect(screen.getByTitle('Reused 3 times').parentElement).toHaveTextContent(
    'entry-1-subject3×'
  );
  // Entries never reused show none.
  expect(screen.getByText('entry-3-subject')).toBeInTheDocument();
  expect(reuseCounts()).toHaveLength(2);
});

it('shows a guest no reuse counts on a public page', async () => {
  await apiClient.forVersion(1).setTagPublic('1', true);
  await apiClient.forVersion(1).setEntryPublic('1', true);
  mount('/test/test-tag-1');

  expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
  expect(
    (await publicSyncSession('test').db.entries.get(['test', '1']))?.attributes
      .reused_count
  ).toBe(0);
  expect(reuseCounts()).toHaveLength(0);
});
