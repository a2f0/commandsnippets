import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedDescending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-date-created-descending"
      onClick={() => {
        appConfig.setTagSortOrder('-date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-date_created' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByDateCreated')} <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateCreatedDescending = React.memo(
  SortByDateCreatedDescending
);

export {memoizedSortByDateCreatedDescending as SortByDateCreatedDescending};
