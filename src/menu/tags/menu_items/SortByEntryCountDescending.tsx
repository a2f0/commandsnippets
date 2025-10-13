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

const SortByEntryCountDescending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-entry-count-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-entry_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-entry_count' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByEntryCount')}
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByEntryCountDescending = React.memo(
  SortByEntryCountDescending
);
export {memoizedSortByEntryCountDescending as SortByEntryCountDescending};
