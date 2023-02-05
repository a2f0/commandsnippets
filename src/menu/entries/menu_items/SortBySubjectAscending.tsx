import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';

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
      id="tagged-entries-menu-sort-subject-descending"
      key="SortMenuItemTextEntrySubject-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-subject');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-subject' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Subject <ArrowUpwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByUserDefinedOrder);
