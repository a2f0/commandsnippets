import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {vi} from 'vitest';
import {apiClient} from '../../src/lib/api/apiClient';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {server} from '../util/msw';
import {signIn} from '../util/signIn';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});
afterEach(() => {
  vi.restoreAllMocks();
});

type Arrow = 'ArrowUpwardIcon' | 'ArrowDownwardIcon';

function renderApp(route: string) {
  const history = createMemoryHistory();
  history.push(route);
  render(<TestAppRouter history={history} />);
}

/** The entry subjects in the order the list shows them. */
function listedSubjects() {
  return screen
    .getAllByText(/^entry-\d-subject$/)
    .map(element => element.textContent);
}

async function expectListed(subjects: string[]) {
  await waitFor(() => expect(listedSubjects()).toEqual(subjects));
}

/** Open the Entries menu and return its sort item with this label and arrow. */
async function openSortItem(label: string, arrow: Arrow) {
  await userEvent.click(screen.getByRole('menu', {name: 'Entries'}));
  const menu = document.getElementById('entries-menu');
  invariant(menu, 'the Entries menu is not rendered');
  const item = within(menu)
    .getAllByRole('menuitem', {name: label})
    .find(element => within(element).queryByTestId(arrow) !== null);
  invariant(item, `no ${label} item with an ${arrow}`);
  return item;
}

async function sortBy(label: string, arrow: Arrow) {
  await userEvent.click(await openSortItem(label, arrow));
}

const ascending = [
  'entry-1-subject',
  'entry-2-subject',
  'entry-3-subject',
  'entry-4-subject',
];
const descending = [...ascending].reverse();

describe('Sorting the entries list from the Entries menu', () => {
  it('sorts a tag list by subject in the direction of the arrow', async () => {
    renderApp('/test/test-tag-1');
    await expectListed(ascending);

    await sortBy('Sort by Subject', 'ArrowDownwardIcon');
    await expectListed(descending);

    await sortBy('Sort by Subject', 'ArrowUpwardIcon');
    await expectListed(ascending);

    const item = await openSortItem('Sort by Subject', 'ArrowUpwardIcon');
    expect(item).toHaveAttribute(
      'id',
      'tagged-entries-menu-sort-subject-ascending'
    );
    expect(within(item).getByTestId('CheckIcon')).toBeInTheDocument();
  });

  it('sorts the untagged list by the chosen sort and checks it', async () => {
    // The mock API's fixtures are all in tag 1: two in no tag.
    await apiClient.forVersion(1).createEntry('entry-8-subject', 'body');
    await apiClient.forVersion(1).createEntry('entry-9-subject', 'body');
    renderApp('/test?entries=untagged');

    await sortBy('Sort by Subject', 'ArrowDownwardIcon');
    await expectListed(['entry-9-subject', 'entry-8-subject']);

    await sortBy('Sort by Subject', 'ArrowUpwardIcon');
    await expectListed(['entry-8-subject', 'entry-9-subject']);

    const item = await openSortItem('Sort by Subject', 'ArrowUpwardIcon');
    expect(within(item).getByTestId('CheckIcon')).toBeInTheDocument();
  });

  it('sorts the all-entries list by the chosen sort, here', async () => {
    renderApp('/test?entries=all');
    await sortBy('Sort by Subject', 'ArrowUpwardIcon');
    await expectListed(ascending);
    const reads = vi.spyOn(apiClient, 'getEntriesAfter');

    await sortBy('Sort by Subject', 'ArrowDownwardIcon');

    await expectListed(descending);
    expect(reads).not.toHaveBeenCalled();
    const item = await openSortItem('Sort by Subject', 'ArrowDownwardIcon');
    expect(within(item).getByTestId('CheckIcon')).toBeInTheDocument();
  });
});
