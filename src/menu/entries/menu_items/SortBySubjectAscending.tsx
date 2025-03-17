import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = ({onClose}: IProps) => {
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
      Sort by Subject <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByUserDefinedOrder);
