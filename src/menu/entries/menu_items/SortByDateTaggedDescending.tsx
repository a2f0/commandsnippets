import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';

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
      Sort by Date Tagged <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

export default React.memo(SortByDateCreatedDescending);
