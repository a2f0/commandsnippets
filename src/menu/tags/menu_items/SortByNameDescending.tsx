import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByNameDescending = ({onClose}: IProps) => {
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
      Sort by Tag Name <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByNameDescending = React.memo(SortByNameDescending);
export {memoizedSortByNameDescending as SortByNameDescending};
