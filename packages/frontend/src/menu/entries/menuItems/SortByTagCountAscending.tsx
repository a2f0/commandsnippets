import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useEntrySortOrder} from '../../../hooks/useEntrySortOrder';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByTagCountAscending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-tag-count-ascending"
      key="SortMenuItemTextEntryTagCount"
      onClick={() => {
        setSortOrder('tag_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {sortOrder === 'tag_count' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByTagCount')}
      <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByTagCountAscending = React.memo(SortByTagCountAscending);

export {memoizedSortByTagCountAscending as SortByTagCountAscending};
