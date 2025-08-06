import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-created-ascending"
      key="SortMenuItemTextEntryDateCreated"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'date_created' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Date Created <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateCreatedAscending = React.memo(
  SortByDateCreatedAscending
);
export {memoizedSortByDateCreatedAscending as SortByDateCreatedAscending};
