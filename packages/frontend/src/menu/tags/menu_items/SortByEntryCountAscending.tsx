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

const SortByEntryCountAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-entry-count-ascending"
      onClick={() => {
        appConfig.setTagSortOrder('entry_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'entry_count' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByEntryCount')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortEntryCountAscending = React.memo(SortByEntryCountAscending);

export {memoizedSortEntryCountAscending as SortByEntryCountAscending};
