import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
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
      id="tagged-entries-menu-sort-subject-ascending"
      key="SortMenuItemTextEntrySubject"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('subject');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'subject' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Subject <ArrowDownwardIcon fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByUserDefinedOrder);
