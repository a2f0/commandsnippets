import ArrowUpwardIcon from '@mui/icons-material/ArrowDownward';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedDescending = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-created-descending"
      key="SortMenuItemTextEntryDateCreated-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-date_created');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-date_created' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Date Created <ArrowUpwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByDateCreatedDescending);
