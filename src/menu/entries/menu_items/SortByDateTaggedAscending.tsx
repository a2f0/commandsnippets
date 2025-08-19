import {ArrowUpward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByDateTaggedAscending = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-date-tagged-ascending"
      key="SortMenuItemTextEntryDateTagged"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('date_tagged');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'date_tagged' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Date Tagged <ArrowUpward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByDateTaggedAscending = React.memo(SortByDateTaggedAscending);
export {memoizedSortByDateTaggedAscending as SortByDateTaggedAscending};
