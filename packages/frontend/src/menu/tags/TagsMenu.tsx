import React from 'react';

import {useAppState} from '../../lib/state/appState';
import {
  type ISort,
  type ISorting,
  SortMenuItem,
  sortMenuItems,
} from '../SortMenuItem';
import {StyledMenu} from '../StyledMenu';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

/** The tag list's sorts after the user-defined order. */
const SORTS: ISort[] = [
  {field: 'name', label: 'sortByTagName'},
  {field: 'date_created', label: 'sortByDateCreated'},
  {field: 'entry_count', label: 'sortByEntryCount'},
  {field: 'date_last_used', label: 'sortByDateLastUsed'},
];

const TagsMenu = ({onClose, anchorEl}: IProps) => {
  const tagSortOrder = useAppState(state => state.tagSortOrder);
  const setTagSortOrder = useAppState(state => state.setTagSortOrder);
  const sorting: ISorting = {
    idPrefix: 'tags-menu-sort',
    current: tagSortOrder,
    onSelect: setTagSortOrder,
    onClose,
  };

  return (
    <StyledMenu
      id="tags-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <SortMenuItem field="order" label="sortByUserDefinedOrder" {...sorting} />
      {sortMenuItems(SORTS, sorting)}
    </StyledMenu>
  );
};

const memoizedTagsMenu = React.memo(TagsMenu);

export {memoizedTagsMenu as TagsMenu};
