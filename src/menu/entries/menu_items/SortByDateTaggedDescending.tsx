import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByDateTaggedDescending = ({onClose}: IProps) => {
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

const memoizedSortByDateTaggedDescending = React.memo(
  SortByDateTaggedDescending
);
export {memoizedSortByDateTaggedDescending as SortByDateTaggedDescending};
