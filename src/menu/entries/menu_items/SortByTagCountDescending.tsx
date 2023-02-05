import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const SortByTagCountDescending = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-tag-count-descending"
      key="SortMenuItemTextEntryTagCount-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-tag_count');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-tag_count' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Tag Count
      <ArrowDownwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByTagCountDescending);
