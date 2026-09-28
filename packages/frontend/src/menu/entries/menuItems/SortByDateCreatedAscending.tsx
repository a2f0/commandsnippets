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

const SortByDateCreatedAscending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-created-ascending"
      key="SortMenuItemTextEntryDateCreated"
      onClick={() => {
        setSortOrder('date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {sortOrder === 'date_created' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateCreated')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateCreatedAscending = React.memo(
  SortByDateCreatedAscending
);

export {memoizedSortByDateCreatedAscending as SortByDateCreatedAscending};
