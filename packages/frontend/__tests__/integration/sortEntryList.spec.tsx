import {render, screen, waitFor, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {store} from '../util/loggedInStore';
import {server} from '../util/msw';
import {TestAppRouter} from '../util/TestAppRouter';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());
afterEach(() => {
  store.setTagTextEntryThroughModelSortOrder('order');
  store.setEntrySortOrder('date_updated');
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
});
