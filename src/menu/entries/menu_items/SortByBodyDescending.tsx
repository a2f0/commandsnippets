import {ArrowDownward} from '@mui/icons-material';
import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tagged-entries-menu-sort-body-descending"
      key="SortMenuItemTextEntryBody-"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('-body');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === '-body' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by Body <ArrowDownward fontSize="small" />
    </StyledMenuItem>
  );
};

const memoizedSortByBodyDescending = React.memo(SortByUserDefinedOrder);
export {memoizedSortByBodyDescending as SortByBodyDescending};
