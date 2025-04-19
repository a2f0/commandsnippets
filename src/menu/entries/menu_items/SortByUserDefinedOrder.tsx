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
      id="tagged-entries-menu-sort-order"
      key="SortMenuItemOrder"
      onClick={() => {
        appConfig.setTagTextEntryThroughModelSortOrder('order');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagTextEntryThroughModelSortOrder === 'order' && (
          <StyledCheckIcon />
        )}
      </ListItemIcon>
      Sort by User-Defined Order
    </StyledMenuItem>
  );
};

const memoizedSortByUserDefinedOrder = React.memo(SortByUserDefinedOrder);
export {memoizedSortByUserDefinedOrder as SortByUserDefinedOrder};
