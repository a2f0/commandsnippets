import ArrowUpwardIcon from '@mui/icons-material/ArrowDownward';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-body-descending"
      key="SortMenuItemTextEntryBody-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-body');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-body' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Body <ArrowUpwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByUserDefinedOrder);
