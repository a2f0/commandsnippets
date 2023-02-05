import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByTagCountAscending = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-tag-count-ascending"
      key="SortMenuItemTextEntryTagCount"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('tag_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'tag_count' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Tag Count
      <ArrowUpwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByTagCountAscending);
