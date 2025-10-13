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
      id="tags-menu-sort-date-created-ascending"
      onClick={() => {
        appConfig.setTagSortOrder('date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'date_created' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateCreated')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateCreatedAscending = React.memo(
  SortByDateCreatedAscending
);
export {memoizedSortByDateCreatedAscending as SortByDateCreatedAscending};
