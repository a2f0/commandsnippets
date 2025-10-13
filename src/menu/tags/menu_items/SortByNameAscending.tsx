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

const SortByNameAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

  return (
    <StyledMenuItem
      id="tags-menu-sort-name-ascending"
      onClick={() => {
        appConfig.setTagSortOrder('-name');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === '-name' && <StyledCheckIcon />}
      </ListItemIcon>
      {t('sortByTagName')} <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByNameAscending = React.memo(SortByNameAscending);
export {memoizedSortByNameAscending as SortByNameAscending};
