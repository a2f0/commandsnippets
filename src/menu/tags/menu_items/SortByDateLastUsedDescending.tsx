import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByNameDescending = ({onClose}: IProps) => {
  const appConfig = useAppContext();

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
      Sort by Tag recently used
      <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateLastUsedDescending = React.memo(SortByNameDescending);
export {memoizedSortByDateLastUsedDescending as SortByDateLastUsedDescending};
