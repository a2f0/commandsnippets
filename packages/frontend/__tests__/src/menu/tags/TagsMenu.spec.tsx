import {ThemeProvider} from '@mui/material/styles';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {describe, expect, it} from 'vitest';

import {AppContext} from '../../../../src/AppContext';
import {i18n} from '../../../../src/i18n/i18n';
import {TagHelpers} from '../../../../src/lib/store/models/TagModel';
import type {Store} from '../../../../src/lib/store/store';
import {TagsMenu} from '../../../../src/menu/tags/TagsMenu';
import {darkTheme} from '../../../../src/theme/themes';
import {createStore, tag} from '../../../util/storeFixtures';

function renderTagsMenu(store: Store) {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <AppContext.Provider value={store}>
          <TagsMenu anchorEl={document.body} onClose={() => {}} />
        </AppContext.Provider>
      </ThemeProvider>
    </I18nextProvider>
  );
}

type Arrow = 'ArrowUpwardIcon' | 'ArrowDownwardIcon';

/** The sort item with this label and arrow, as the user tells them apart. */
function sortItem(label: string, arrow: Arrow) {
  const item = screen
    .getAllByRole('menuitem', {name: label})
    .find(element => within(element).queryByTestId(arrow) !== null);
  invariant(item, `no ${label} item with an ${arrow}`);
  return item;
}

function tagNames(store: Store) {
  return TagHelpers.filterAndSort(store).map(t => t.attributes.name);
}

describe('TagsMenu', () => {
  describe('Sort by Tag Name', () => {
    const tags = [
      tag('1', {name: 'bravo'}),
      tag('2', {name: 'Charlie'}),
      tag('3', {name: 'alpha'}),
    ];

    it.each<[string, Arrow, string, string[]]>([
      [
        'ascending',
        'ArrowUpwardIcon',
        'tags-menu-sort-name-ascending',
        ['alpha', 'bravo', 'Charlie'],
      ],
      [
        'descending',
        'ArrowDownwardIcon',
        'tags-menu-sort-name-descending',
        ['Charlie', 'bravo', 'alpha'],
      ],
    ])(
      'sorts the tags %s and checks that item',
      async (_direction, arrow, id, expected) => {
        const store = createStore(tags);
        const {unmount} = renderTagsMenu(store);

        await userEvent.click(sortItem('Sort by Tag Name', arrow));

        expect(tagNames(store)).toEqual(expected);

        // The items read the store when the menu renders again (reopens).
        unmount();
        renderTagsMenu(store);
        const item = sortItem('Sort by Tag Name', arrow);
        expect(item).toHaveAttribute('id', id);
        expect(within(item).getByTestId('CheckIcon')).toBeInTheDocument();
      }
    );
  });
});
