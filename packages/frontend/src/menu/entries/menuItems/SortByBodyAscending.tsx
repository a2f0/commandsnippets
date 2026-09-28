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

const SortByBodyAscending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-body-ascending"
      key="SortMenuItemTextEntryBody"
      onClick={() => {
        setSortOrder('body');
        onClose();
      }}
    >
      <ListItemIcon>{sortOrder === 'body' && <StyledCheckIcon />}</ListItemIcon>
      {t('sortByBody')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByBodyAscending = React.memo(SortByBodyAscending);

export {memoizedSortByBodyAscending as SortByBodyAscending};
