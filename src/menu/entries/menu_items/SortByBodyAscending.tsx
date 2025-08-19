import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByBodyAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-body-ascending"
      key="SortMenuItemTextEntryBody"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('body');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'body' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Body <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByBodyAscending = React.memo(SortByBodyAscending);
export {memoizedSortByBodyAscending as SortByBodyAscending};
