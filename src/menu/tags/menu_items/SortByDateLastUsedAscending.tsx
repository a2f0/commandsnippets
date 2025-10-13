import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-date-last-used-ascending"
      onClick={() => {
        appConfig.setTagSortOrder('date_last_used');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'date_last_used' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateLastUsed')}
      <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateLastUsedAscending = React.memo(
  SortByDateCreatedAscending
);
export {memoizedSortByDateLastUsedAscending as SortByDateLastUsedAscending};
