/**
 * An entry's page (`/:user/entries/:id`), which Get Info in its context menu
 * opens: its subject, body and info, and every time it was reused, newest
 * first. The reuses are private: its owner sees them, staff their count only,
 * and a public page neither.
 */
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import {createMemoryHistory, type MemoryHistory} from 'history';
import {HttpResponse, http} from 'msw/http';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn, store} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());
beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  Object.defineProperty(navigator, 'clipboard', {
    value: {writeText: vi.fn().mockResolvedValue(undefined)},
    configurable: true,
  });
});

const mount = (url: string): MemoryHistory => {
  const history = createMemoryHistory();
  history.push(url);
  render(<TestAppRouter history={history} />);
  return history;
};

const signInHere = () => {
  signIn();
  assignLoggedInCookie();
};

/** The page's info field `key` (`entryInfo<key>`). */
const field = (key: string) => {
  const element = document.getElementById(`entryInfo${key}`);
  if (element === null) {
    throw new Error(`no field ${key}`);
  }
  return element;
};

const reuseList = () => screen.findByRole('list');

it('opens from Get Info, shows the entry and its reuses, and goes back to the list', async () => {
  signInHere();
  // Two copies recorded before (another device's).
  await apiClient.forVersion(1).reuseEntry('1', 'earlier');
  await apiClient.forVersion(1).reuseEntry('1', 'later');
  const history = mount('/test/test-tag-1');

  fireEvent.contextMenu(await screen.findByText('entry-1-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Get Info'}));

  await waitFor(() =>
    expect(history.location.pathname).toBe('/test/entries/1')
  );
  expect(
    await screen.findByRole('heading', {name: 'entry-1-subject'})
  ).toBeInTheDocument();
  expect(screen.getByLabelText('Body')).toHaveTextContent('entry-1-body');
  await waitFor(() => expect(field('Tags')).toHaveTextContent('test-tag-1'));
  expect(
    within(field('Tags')).getByRole('link', {name: 'test-tag-1'})
  ).toHaveAttribute('href', '/test/test-tag-1');
  expect(field('Visibility')).toHaveTextContent('Private');
  expect(field('Size')).toHaveTextContent('12 characters · 1 line');
  expect(field('Id')).toHaveTextContent('1');
  // Read again on opening: the count the API holds.
  await waitFor(() => expect(field('Reused')).toHaveTextContent('2 times'));
  expect(within(await reuseList()).getAllByRole('listitem')).toHaveLength(2);

  fireEvent.click(screen.getByRole('button', {name: 'Back'}));
  expect(history.location.pathname).toBe('/test/test-tag-1');
  expect(await screen.findByText('entry-1-subject')).toBeInTheDocument();
});

it('counts a copy made on the page, which joins its reuses', async () => {
  signInHere();
  mount('/test/entries/2');
  expect(await screen.findByText('Not reused yet.')).toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', {name: 'Copy'}));

  expect(navigator.clipboard.writeText).toHaveBeenCalledWith('entry-2-body');
  expect(
    await screen.findByRole('button', {name: 'Copied'})
  ).toBeInTheDocument();
  await waitFor(() => expect(field('Reused')).toHaveTextContent('1 time'));
  expect(within(await reuseList()).getAllByRole('listitem')).toHaveLength(1);
  expect(
    (await apiClient.forVersion(1).getEntry('2')).data.attributes.reused_count
  ).toBe(1);
});

it("lists a deep link's reuses, and goes back to the user's page", async () => {
  signInHere();
  await apiClient.forVersion(1).reuseEntry('1', 'first');
  await apiClient.forVersion(1).reuseEntry('1', 'second');
  const history = mount('/test/entries/1');

  expect(within(await reuseList()).getAllByRole('listitem')).toHaveLength(2);
  // Opened by a link, not from a list: Back goes to the user's page.
  fireEvent.click(screen.getByRole('button', {name: 'Back'}));
  expect(history.location.pathname).toBe('/test');
});

it('says when there is no such entry', async () => {
  signInHere();
  mount('/test/entries/999');
  expect(
    await screen.findByText('There is no such entry.')
  ).toBeInTheDocument();
});

it("shows staff another user's entry and its count, not its reuses", async () => {
  signInHere();
  act(() => store.setIsStaff(true));
  mount('/alice/entries/71');

  expect(
    await screen.findByRole('heading', {name: 'alices-entry'})
  ).toBeInTheDocument();
  expect(field('Reused')).toHaveTextContent('0 times');
  expect(
    await screen.findByText("Only the entry's owner sees when it was reused.")
  ).toBeInTheDocument();
});

it('shows a guest a public entry without its reuses', async () => {
  await apiClient.forVersion(1).setTagPublic('1', true);
  await apiClient.forVersion(1).setEntryPublic('1', true);
  await apiClient.forVersion(1).reuseEntry('1', 'private');
  mount('/test/entries/1');

  expect(
    await screen.findByRole('heading', {name: 'entry-1-subject'})
  ).toBeInTheDocument();
  expect(document.getElementById('entryInfoReused')).toBeNull();
  expect(screen.queryByRole('heading', {name: 'Reuses'})).toBeNull();
  expect(screen.queryByRole('list')).toBeNull();
});

it("goes back to the list each entry's page was opened from", async () => {
  signInHere();
  const history = mount('/test/test-tag-1');
  fireEvent.contextMenu(await screen.findByText('entry-1-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Get Info'}));
  await screen.findByRole('heading', {name: 'entry-1-subject'});
  act(() => history.push('/test?entries=all'));
  fireEvent.contextMenu(await screen.findByText('entry-3-subject'));
  fireEvent.click(await screen.findByRole('menuitem', {name: 'Get Info'}));
  await screen.findByRole('heading', {name: 'entry-3-subject'});

  // The first entry's page again (Forward, say): its Back is still its own.
  act(() => history.push('/test/entries/1'));
  await screen.findByRole('heading', {name: 'entry-1-subject'});
  fireEvent.click(screen.getByRole('button', {name: 'Back'}));
  expect(`${history.location.pathname}${history.location.search}`).toBe(
    '/test/test-tag-1'
  );
});

it('signs out when the login cookie is gone, showing nothing private', async () => {
  // Signed in here, but the user has cleared their cookies since.
  signIn();
  assignLoggedInCookie('');
  mount('/test/entries/1');

  await waitFor(() => expect(store.loggedInUser).toBeNull());
  expect(screen.queryByRole('heading', {name: 'entry-1-subject'})).toBeNull();
});

it("shows none of the last entry's reuses on another entry's page", async () => {
  signInHere();
  await apiClient.forVersion(1).reuseEntry('1', 'one');
  const history = mount('/test/entries/1');
  expect(within(await reuseList()).getAllByRole('listitem')).toHaveLength(1);
  server.use(
    http.get('http://localhost:9001/api/v1/entry_reuses', () =>
      HttpResponse.error()
    )
  );

  act(() => history.push('/test/entries/2'));

  await screen.findByRole('heading', {name: 'entry-2-subject'});
  expect(
    await screen.findByText('The reuses could not be read.')
  ).toBeInTheDocument();
  expect(document.getElementById('entryReuses')).toBeNull();
});

it('reads the reuses again once back online: a copy made offline', async () => {
  signInHere();
  mount('/test/entries/2');
  expect(await screen.findByText('Not reused yet.')).toBeInTheDocument();
  // Offline: the copy is counted here, but neither sent nor listed.
  server.use(
    http.all('http://localhost:9001/api/v1/*', () => HttpResponse.error())
  );
  fireEvent.click(screen.getByRole('button', {name: 'Copy'}));
  await waitFor(() => expect(field('Reused')).toHaveTextContent('1 time'));
  expect(screen.getByText('Not reused yet.')).toBeInTheDocument();

  server.resetHandlers();
  act(() => {
    window.dispatchEvent(new Event('online'));
  });

  expect(within(await reuseList()).getAllByRole('listitem')).toHaveLength(1);
});
