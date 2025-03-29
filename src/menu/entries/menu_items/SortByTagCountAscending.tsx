import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByTagCountAscending = ({onClose}: IProps) => {
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
      <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByTagCountAscending);
