import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ListItemIcon from '@mui/material/ListItemIcon';
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
      id="tags-menu-sort-name-descending"
      onClick={() => {
        appConfig.setTagSortOrder('name');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'name' && <StyledCheckIcon />}
      </ListItemIcon>
      Sort by Tag Name <ArrowDownwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByNameDescending);
