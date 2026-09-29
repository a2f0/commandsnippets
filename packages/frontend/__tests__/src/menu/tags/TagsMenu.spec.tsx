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
