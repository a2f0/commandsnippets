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

const SortByBodyDescending = ({onClose}: IProps) => {
  const {sortOrder, setSortOrder} = useEntrySortOrder();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-body-descending"
      key="SortMenuItemTextEntryBody-"
      onClick={() => {
        setSortOrder('-body');
        onClose();
      }}
    >
      <ListItemIcon>
        {sortOrder === '-body' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByBody')} <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByBodyDescending = React.memo(SortByBodyDescending);

export {memoizedSortByBodyDescending as SortByBodyDescending};
