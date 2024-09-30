import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByBodyAscending = function ({onClose}: IProps) {
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

export default React.memo(SortByBodyAscending);
