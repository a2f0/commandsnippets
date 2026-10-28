import {ThemeProvider} from '@mui/material/styles';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {describe, expect, it} from 'vitest';

import {i18n} from '../../../../src/i18n/i18n';
import {Router} from '../../../../src/lib/router/Router';
import {EntriesMenu} from '../../../../src/menu/entries/EntriesMenu';
import {darkTheme} from '../../../../src/theme/themes';
import {store} from '../../../util/signIn';

const tagList = '/test/shell';
const untaggedList = '/test?entries=untagged';
const allEntriesList = '/test?entries=all';

function renderEntriesMenu(route: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <Router history={createMemoryHistory({initialEntries: [route]})}>
          <EntriesMenu anchorEl={document.body} onClose={() => {}} />
        </Router>
      </ThemeProvider>
    </I18nextProvider>
  );
}

const label = (item: HTMLElement) => item.textContent?.trim();

type Arrow = 'ArrowUpwardIcon' | 'ArrowDownwardIcon';
const arrows: Arrow[] = ['ArrowUpwardIcon', 'ArrowDownwardIcon'];

const arrowOf = (item: HTMLElement) =>
  arrows.find(arrow => within(item).queryByTestId(arrow) !== null) ?? null;

/** The sort items, their labels, and the checked items. */
function sortItems() {
  const items = screen
    .getAllByRole('menuitem')
    .filter(item => label(item)?.startsWith('Sort by'));
  const labels = [...new Set(items.map(label))];
  const checked = items.filter(
    item => within(item).queryByTestId('CheckIcon') !== null
  );
  return {items, labels, checked};
}

/**
 * Every sort item of a tag's list, in menu order: its id (the E2E specs find
 * items by id), label, arrow, and the order it sets.
 */
const tagListSorts: [string, string, Arrow | null, string][] = [
  [
    'tagged-entries-menu-sort-order',
    'Sort by User-Defined Order',
    null,
    'order',
  ],
  [
    'tagged-entries-menu-sort-date-tagged-descending',
    'Sort by Date Tagged',
    'ArrowDownwardIcon',
    '-date_tagged',
  ],
  [
    'tagged-entries-menu-sort-date-tagged-ascending',
    'Sort by Date Tagged',
    'ArrowUpwardIcon',
    'date_tagged',
  ],
  [
    'tagged-entries-menu-sort-subject-descending',
    'Sort by Subject',
    'ArrowDownwardIcon',
    '-subject',
  ],
  [
    'tagged-entries-menu-sort-subject-ascending',
    'Sort by Subject',
    'ArrowUpwardIcon',
    'subject',
  ],
  [
    'tagged-entries-menu-sort-body-descending',
    'Sort by Body',
    'ArrowDownwardIcon',
    '-body',
  ],
  [
    'tagged-entries-menu-sort-body-ascending',
    'Sort by Body',
    'ArrowUpwardIcon',
    'body',
  ],
  [
    'tagged-entries-menu-sort-date-created-descending',
    'Sort by Date Created',
    'ArrowDownwardIcon',
    '-date_created',
  ],
  [
    'tagged-entries-menu-sort-date-created-ascending',
    'Sort by Date Created',
    'ArrowUpwardIcon',
    'date_created',
  ],
  [
    'tagged-entries-menu-sort-tag-count-descending',
    'Sort by Tag Count',
    'ArrowDownwardIcon',
    '-tag_count',
  ],
  [
    'tagged-entries-menu-sort-tag-count-ascending',
    'Sort by Tag Count',
    'ArrowUpwardIcon',
    'tag_count',
  ],
];

type SortField = 'tagTextEntryThroughModelSortOrder' | 'entrySortOrder';

function sortItemById(id: string) {
  const item = sortItems().items.find(element => element.id === id);
  invariant(item, `no sort item ${id}`);
  return item;
}

/** The all-entries list's: no user-defined order, nor date tagged. */
const allEntriesSorts = tagListSorts.slice(3);

/** The untagged list's: no tag count either. */
const untaggedSorts = allEntriesSorts.slice(0, -2);

function bodyDescending() {
  const item = screen
    .getAllByRole('menuitem', {name: 'Sort by Body'})
    .find(element => within(element).queryByTestId('ArrowDownwardIcon'));
  invariant(item, 'no Sort by Body item with a down arrow');
  return item;
}

describe('EntriesMenu', () => {
  it('offers every sort for a tag list, checking the one it applies', () => {
    renderEntriesMenu(tagList);

    const {labels, checked} = sortItems();
    expect(labels).toEqual([
      'Sort by User-Defined Order',
      'Sort by Date Tagged',
      'Sort by Subject',
      'Sort by Body',
      'Sort by Date Created',
      'Sort by Tag Count',
    ]);
    expect(checked.map(label)).toEqual(['Sort by User-Defined Order']);
  });

  // They sort by entrySortOrder, with no tag-only sorts; the untagged
  // list's entries all have no tags, so it has no tag count sort.
  it.each([
    [untaggedList, ['Sort by Subject', 'Sort by Body', 'Sort by Date Created']],
    [
      allEntriesList,
      [
        'Sort by Subject',
        'Sort by Body',
        'Sort by Date Created',
        'Sort by Tag Count',
      ],
    ],
  ])(
    'offers the entry sorts on %s, checking none by default',
    (route, sorts) => {
      renderEntriesMenu(route);

      const {labels, checked} = sortItems();
      expect(labels).toEqual(sorts);
      // The list sorts by date updated, which has no item.
      expect(checked).toEqual([]);
    }
  );

  it.each([
    [tagList, tagListSorts],
    [untaggedList, untaggedSorts],
    [allEntriesList, allEntriesSorts],
  ])('names each sort item on %s by id, label and arrow', (route, sorts) => {
    renderEntriesMenu(route);

    expect(
      sortItems().items.map(item => [item.id, label(item), arrowOf(item)])
    ).toEqual(sorts.map(([id, name, arrow]) => [id, name, arrow]));
  });

  describe.each<[string, SortField, SortField, typeof tagListSorts]>([
    [
      tagList,
      'tagTextEntryThroughModelSortOrder',
      'entrySortOrder',
      tagListSorts,
    ],
    [
      untaggedList,
      'entrySortOrder',
      'tagTextEntryThroughModelSortOrder',
      untaggedSorts,
    ],
    [
      allEntriesList,
      'entrySortOrder',
      'tagTextEntryThroughModelSortOrder',
      allEntriesSorts,
    ],
  ])('on %s, in %s', (route, field, other, sorts) => {
    it.each(sorts)(
      '%s sets and checks its order',
      async (id, _label, _arrow, order) => {
        // An order no item sets (the untagged and all-entries lists'
        // default), so each item must set its own.
        store.setTagTextEntryThroughModelSortOrder('date_updated');
        store.setEntrySortOrder('date_updated');
        const {unmount} = renderEntriesMenu(route);
        expect(sortItems().checked).toEqual([]);
        const otherBefore = store[other];

        await userEvent.click(sortItemById(id));

        expect(store[field]).toBe(order);
        expect(store[other]).toBe(otherBefore);
        // The items read the store when the menu renders again (reopens).
        unmount();
        renderEntriesMenu(route);
        expect(sortItems().checked.map(item => item.id)).toEqual([id]);
      }
    );
  });

  it.each<[string, 'tagTextEntryThroughModelSortOrder' | 'entrySortOrder']>([
    [tagList, 'tagTextEntryThroughModelSortOrder'],
    [untaggedList, 'entrySortOrder'],
    [allEntriesList, 'entrySortOrder'],
  ])(
    'on %s sets and checks %s, which that list sorts by',
    async (route, field) => {
      const {unmount} = renderEntriesMenu(route);
      const other =
        field === 'entrySortOrder'
          ? 'tagTextEntryThroughModelSortOrder'
          : 'entrySortOrder';
      const otherBefore = store[other];

      await userEvent.click(bodyDescending());

      expect(store[field]).toBe('-body');
      expect(store[other]).toBe(otherBefore);
      // The items read the store when the menu renders again (reopens).
      unmount();
      renderEntriesMenu(route);
      expect(sortItems().checked).toEqual([bodyDescending()]);
    }
  );

  it.each<[string, 'tagTextEntryThroughModelSortOrder' | 'entrySortOrder']>([
    [tagList, 'tagTextEntryThroughModelSortOrder'],
    [allEntriesList, 'entrySortOrder'],
  ])('on %s sorts by tag count in %s', async (route, field) => {
    renderEntriesMenu(route);
    const [descending, ascending] = screen.getAllByRole('menuitem', {
      name: 'Sort by Tag Count',
    });
    invariant(descending && ascending, 'no Sort by Tag Count items');
    expect(within(descending).getByTestId('ArrowDownwardIcon')).toBeVisible();

    await userEvent.click(descending);
    expect(store[field]).toBe('-tag_count');

    await userEvent.click(ascending);
    expect(store[field]).toBe('tag_count');
  });
});
