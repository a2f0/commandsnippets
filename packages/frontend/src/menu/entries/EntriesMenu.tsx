import React from 'react';

import {useEntrySortOrder} from '../../hooks/useEntrySortOrder';
import {useSearchParam} from '../../lib/router/navigation';
import {StyledDivider} from '../../styled/StyledDivider';
import {
  type ISort,
  type ISorting,
  SortMenuItem,
  sortMenuItems,
} from '../SortMenuItem';
import {StyledMenu} from '../StyledMenu';
import {AllEntries} from './menuItems/AllEntries';
import {UntaggedEntries} from './menuItems/UntaggedEntries';

interface IProps {
  onClose: () => void;
  anchorEl: HTMLElement | null;
}

const DATE_TAGGED: ISort = {field: 'date_tagged', label: 'sortByDateTagged'};

const ENTRY_SORTS: ISort[] = [
  {field: 'subject', label: 'sortBySubject'},
  {field: 'body', label: 'sortByBody'},
  {field: 'date_created', label: 'sortByDateCreated'},
];

const TAG_COUNT: ISort = {field: 'tag_count', label: 'sortByTagCount'};

const EntriesMenu = ({onClose, anchorEl}: IProps) => {
  // The sort items sort the list on screen (useEntrySortOrder). The untagged
  // and all-entries lists have no tag order, so only a tag's list offers the
  // user-defined order and date tagged; the untagged list's entries all have
  // no tags, so it has no tag count sort.
  const {tagList, sortOrder, setSortOrder} = useEntrySortOrder();
  const untaggedList = useSearchParam('entries') === 'untagged';
  const sorting: ISorting = {
    idPrefix: 'tagged-entries-menu-sort',
    current: sortOrder,
    onSelect: setSortOrder,
    onClose,
  };

  return (
    <StyledMenu
      id="entries-menu"
      anchorEl={anchorEl}
      open={Boolean(anchorEl)}
      onClose={onClose}
    >
      <AllEntries onClose={onClose} />
      <UntaggedEntries onClose={onClose} />
      <StyledDivider />
      {tagList && [
        <SortMenuItem
          key="order"
          field="order"
          label="sortByUserDefinedOrder"
          {...sorting}
        />,
        ...sortMenuItems([DATE_TAGGED], sorting),
      ]}
      {sortMenuItems(ENTRY_SORTS, sorting)}
      {!untaggedList && sortMenuItems([TAG_COUNT], sorting)}
    </StyledMenu>
  );
};

const memoizedEntriesMenu = React.memo(EntriesMenu);

export {memoizedEntriesMenu as EntriesMenu};
