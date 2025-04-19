import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByNameAscending = ({onClose}: IProps) => {
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

const memoizedSortByNameAscending = React.memo(SortByNameAscending);
export {memoizedSortByNameAscending as SortByNameAscending};
