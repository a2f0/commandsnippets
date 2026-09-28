import {ThemeProvider} from '@mui/material/styles';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {MemoryRouter} from 'react-router-dom';
import {describe, expect, it} from 'vitest';

import {AppContext} from '../../../../src/AppContext';
import {i18n} from '../../../../src/i18n/i18n';
import type {Store} from '../../../../src/lib/store/store';
import {EntriesMenu} from '../../../../src/menu/entries/EntriesMenu';
import {darkTheme} from '../../../../src/theme/themes';
import {createStore} from '../../../util/storeFixtures';

const tagList = '/test/shell';
const untaggedList = '/test?entries=untagged';
const allEntriesList = '/test?entries=all';

function renderEntriesMenu(store: Store, route: string) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <MemoryRouter initialEntries={[route]}>
          <AppContext.Provider value={store}>
            <EntriesMenu anchorEl={document.body} onClose={() => {}} />
          </AppContext.Provider>
        </MemoryRouter>
      </ThemeProvider>
    </I18nextProvider>
  );
}

const label = (item: HTMLElement) => item.textContent?.trim();

/** The sort items' labels, and the checked items. */
function sortItems() {
  const items = screen
    .getAllByRole('menuitem')
    .filter(item => label(item)?.startsWith('Sort by'));
  const labels = [...new Set(items.map(label))];
  const checked = items.filter(
    item => within(item).queryByTestId('CheckIcon') !== null
  );
  return {labels, checked};
}

function bodyDescending() {
  const item = screen
    .getAllByRole('menuitem', {name: 'Sort by Body'})
    .find(element => within(element).queryByTestId('ArrowDownwardIcon'));
  invariant(item, 'no Sort by Body item with a down arrow');
  return item;
}

describe('EntriesMenu', () => {
  it('offers every sort for a tag list, checking the one it applies', () => {
    renderEntriesMenu(createStore(), tagList);

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

  // They sort by entrySortOrder, and the API sorts the all-entries list: it
  // has no tag-only sorts, and cannot sort by tag count.
  it.each([untaggedList, allEntriesList])(
    'offers the entry sorts on %s, checking none by default',
    route => {
      renderEntriesMenu(createStore(), route);

      const {labels, checked} = sortItems();
      expect(labels).toEqual([
        'Sort by Subject',
        'Sort by Body',
        'Sort by Date Created',
      ]);
      // The list sorts by date updated, which has no item.
      expect(checked).toEqual([]);
    }
  );

  it.each<[string, 'tagTextEntryThroughModelSortOrder' | 'entrySortOrder']>([
    [tagList, 'tagTextEntryThroughModelSortOrder'],
    [untaggedList, 'entrySortOrder'],
    [allEntriesList, 'entrySortOrder'],
  ])(
    'on %s sets and checks %s, which that list sorts by',
    async (route, field) => {
      const store = createStore();
      const {unmount} = renderEntriesMenu(store, route);
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
      renderEntriesMenu(store, route);
      expect(sortItems().checked).toEqual([bodyDescending()]);
    }
  );
});
