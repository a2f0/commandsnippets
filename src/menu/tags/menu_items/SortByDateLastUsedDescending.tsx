import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByNameDescending = function ({onClose}: IProps) {
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

export default React.memo(SortByNameDescending);
