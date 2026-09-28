import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useEntrySortOrder} from '../../../hooks/useEntrySortOrder';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedDescending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-created-descending"
      key="SortMenuItemTextEntryDateCreated-"
      onClick={() => {
        setSortOrder('-date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {sortOrder === '-date_created' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateCreated')} <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateCreatedDescending = React.memo(
  SortByDateCreatedDescending
);

export {memoizedSortByDateCreatedDescending as SortByDateCreatedDescending};
