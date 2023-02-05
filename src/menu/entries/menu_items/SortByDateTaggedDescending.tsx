import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
      id="tagged-entries-menu-sort-date-tagged-descending"
      key="SortMenuItemTextEntryDateTagged-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-date_tagged');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-date_tagged' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Date Tagged <ArrowDownwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByDateCreatedDescending);
