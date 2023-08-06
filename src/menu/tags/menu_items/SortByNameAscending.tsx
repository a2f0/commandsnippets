import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByNameAscending = function ({onClose}: IProps) {
  const appConfig = useAppContext();

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
      Sort by Tag Name <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByNameAscending);
