/**
 * An entry's reuse count (`reused_count`) shows beside its subject for its
 * owner, and not for an entry never reused. Each copy is a reuse, counted at
 * once and sent like any write. It is private: public pages get 0 from the
 * API, so a guest sees none, and a guest's copy counts nothing. (An entry's
 * page, Get Info, is `entryPage.spec.tsx`.)
 */
import {fireEvent, render, screen, within} from '@testing-library/react';
import {createMemoryHistory} from 'history';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {publicSyncSession, syncSession} from '../../src/lib/sync/session';
import {setRuntimeEntriesOverride} from '../../src/msw/handlers';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, TEST_USER} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  server.events.removeAllListeners();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  // Clicking an entry's body copies it.
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
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

const signInHere = () => {
  signIn();
  assignLoggedInCookie();
};

const reuseCounts = () => screen.queryAllByTitle(/^Reused /);

/** The reuses sent from now on. */
function reusesSent(): string[] {
  const sent: string[] = [];
  server.events.on('request:start', ({request}) => {
    if (new URL(request.url).pathname.endsWith('/entry_reuses')) {
      sent.push(request.method);
    }
  });
  return sent;
}

/** Open entry `subject`'s context menu, and its menu items' names. */
async function openMenu(subject: string, id: string): Promise<string[]> {
  fireEvent.contextMenu(await screen.findByText(subject));
  const menu = await screen.findByRole('menu');
  expect(menu.closest(`#tagsEntriesContextMenu-${id}`)).not.toBeNull();
  return within(menu)
    .getAllByRole('menuitem')
    .map(item => item.textContent);
}

it("shows the owner each entry's reuse count beside its subject", async () => {
  signInHere();
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

it('counts a copy as a reuse at once, and sends it once', async () => {
  signInHere();
  const sent = reusesSent();
  mount('/test/test-tag-1');

  fireEvent.click(await screen.findByText('entry-1-body'));

  expect(await screen.findByTitle('Reused 4 times')).toHaveTextContent('4×');
  await syncSession(TEST_USER).sync.flush();
  expect(sent).toEqual(['POST']);
  expect(
    (await apiClient.forVersion(1).getEntry('1')).data.attributes.reused_count
  ).toBe(4);
});

it('counts a copy made with Enter in the list', async () => {
  signInHere();
  mount('/test/test-tag-1');
  // Selected (and copied) by a click on its body.
  fireEvent.click(await screen.findByText('entry-1-body'));
  expect(await screen.findByTitle('Reused 4 times')).toBeInTheDocument();

  fireEvent.keyDown(document, {key: 'Enter', code: 'Enter'});

  expect(await screen.findByTitle('Reused 5 times')).toHaveTextContent('5×');
  expect(navigator.clipboard.writeText).toHaveBeenLastCalledWith(
    'entry-1-body'
  );
});

it('shows a guest no reuse counts on a public page, and counts no copy', async () => {
  await apiClient.forVersion(1).setTagPublic('1', true);
  await apiClient.forVersion(1).setEntryPublic('1', true);
  const sent = reusesSent();
  mount('/test/test-tag-1');

  fireEvent.click(await screen.findByText('entry-1-body'));

  expect(
    (await publicSyncSession('test').db.entries.get(['test', '1']))?.attributes
      .reused_count
  ).toBe(0);
  expect(reuseCounts()).toHaveLength(0);
  expect(sent).toEqual([]);
  // Nor is its info offered: the count is private.
  expect(await openMenu('entry-1-subject', '1')).toEqual(['Copy']);
});
