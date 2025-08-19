import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByDateCreatedDescending = ({onClose}: IProps) => {
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
      Sort by Date Created <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateCreatedDescending = React.memo(
  SortByDateCreatedDescending
);
export {memoizedSortByDateCreatedDescending as SortByDateCreatedDescending};
