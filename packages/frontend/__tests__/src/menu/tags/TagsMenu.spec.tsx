import {ThemeProvider} from '@mui/material/styles';
import {render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import invariant from 'invariant';
import {I18nextProvider} from 'react-i18next';
import {describe, expect, it} from 'vitest';

import {i18n} from '../../../../src/i18n/i18n';
import type {ITagJsonApi} from '../../../../src/lib/api/responses/types';
import {sortTags} from '../../../../src/lib/data/sort';
import {TagsMenu} from '../../../../src/menu/tags/TagsMenu';
import {darkTheme} from '../../../../src/theme/themes';
import {store} from '../../../util/signIn';
import {tag} from '../../../util/storeFixtures';

function renderTagsMenu() {
  return render(
    <I18nextProvider i18n={i18n}>
      <ThemeProvider theme={darkTheme}>
        <TagsMenu anchorEl={document.body} onClose={() => {}} />
      </ThemeProvider>
    </I18nextProvider>
  );
}

type Arrow = 'ArrowUpwardIcon' | 'ArrowDownwardIcon';
const arrows: Arrow[] = ['ArrowUpwardIcon', 'ArrowDownwardIcon'];

const arrowOf = (item: HTMLElement) =>
  arrows.find(arrow => within(item).queryByTestId(arrow) !== null) ?? null;

/**
 * Every item, in menu order: its id (the E2E specs find items by id), label,
 * arrow, and the order it sets.
 */
const sorts: [string, string, Arrow | null, string][] = [
  ['tags-menu-sort-order', 'Sort by User-Defined Order', null, 'order'],
  [
    'tags-menu-sort-name-descending',
    'Sort by Tag Name',
    'ArrowDownwardIcon',
    '-name',
  ],
  [
    'tags-menu-sort-name-ascending',
    'Sort by Tag Name',
    'ArrowUpwardIcon',
    'name',
  ],
  [
    'tags-menu-sort-date-created-descending',
    'Sort by Date Created',
    'ArrowDownwardIcon',
    '-date_created',
  ],
  [
    'tags-menu-sort-date-created-ascending',
    'Sort by Date Created',
    'ArrowUpwardIcon',
    'date_created',
  ],
  [
    'tags-menu-sort-entry-count-descending',
    'Sort by Entry Count',
    'ArrowDownwardIcon',
    '-entry_count',
  ],
  [
    'tags-menu-sort-entry-count-ascending',
    'Sort by Entry Count',
    'ArrowUpwardIcon',
    'entry_count',
  ],
  [
    'tags-menu-sort-date-last-used-descending',
    'Sort by Date Last Used',
    'ArrowDownwardIcon',
    '-date_last_used',
  ],
  [
    'tags-menu-sort-date-last-used-ascending',
    'Sort by Date Last Used',
    'ArrowUpwardIcon',
    'date_last_used',
  ],
];

function itemById(id: string) {
  const item = screen
    .getAllByRole('menuitem')
    .find(element => element.id === id);
  invariant(item, `no item ${id}`);
  return item;
}

const checkedIds = () =>
  screen
    .getAllByRole('menuitem')
    .filter(item => within(item).queryByTestId('CheckIcon') !== null)
    .map(item => item.id);

/** The sort item with this label and arrow, as the user tells them apart. */
function sortItem(label: string, arrow: Arrow) {
  const item = screen
    .getAllByRole('menuitem', {name: label})
    .find(element => within(element).queryByTestId(arrow) !== null);
  invariant(item, `no ${label} item with an ${arrow}`);
  return item;
}

/** `tags` as the tag list sorts them now. */
function tagNames(tags: ITagJsonApi[]) {
  return sortTags(tags, store.tagSortOrder, '').map(t => t.attributes.name);
}

describe('TagsMenu', () => {
  it('names each item by id, label and arrow', () => {
    renderTagsMenu();

    expect(
      screen
        .getAllByRole('menuitem')
        .map(item => [item.id, item.textContent?.trim(), arrowOf(item)])
    ).toEqual(sorts.map(([id, label, arrow]) => [id, label, arrow]));
    expect(checkedIds()).toEqual(['tags-menu-sort-order']);
  });

  it.each(sorts)(
    '%s sets and checks its order',
    async (id, _label, _arrow, order) => {
      // An order no item sets, so each item must set its own.
      store.setTagSortOrder('date_updated');
      const {unmount} = renderTagsMenu();
      expect(checkedIds()).toEqual([]);

      await userEvent.click(itemById(id));

      expect(store.tagSortOrder).toBe(order);
      // The items read the order when the menu renders again (reopens).
      unmount();
      renderTagsMenu();
      expect(checkedIds()).toEqual([id]);
    }
  );

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
        const {unmount} = renderTagsMenu();

        await userEvent.click(sortItem('Sort by Tag Name', arrow));

        expect(tagNames(tags)).toEqual(expected);

        // The items read the order when the menu renders again (reopens).
        unmount();
        renderTagsMenu();
        const item = sortItem('Sort by Tag Name', arrow);
        expect(item).toHaveAttribute('id', id);
        expect(within(item).getByTestId('CheckIcon')).toBeInTheDocument();
      }
    );
  });
});
