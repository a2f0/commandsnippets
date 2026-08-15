import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByDateLastUsedDescending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-date-last-used-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-date_last_used');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-date_last_used' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateLastUsed')}
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateLastUsedDescending = React.memo(
  SortByDateLastUsedDescending
);
export {memoizedSortByDateLastUsedDescending as SortByDateLastUsedDescending};
