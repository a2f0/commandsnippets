import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const SortByUserDefinedOrder = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="tags-menu-sort-order"
      onClick={() => {
        appConfig.setTagSortOrder('order');
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.tagSortOrder === 'order' && <StyledCheckIcon />}
      </ListItemIcon>
      Sort by User-Defined Order
    </StyledMenuItem>
  );
};

const memoizedSortByUserDefinedOrder = React.memo(SortByUserDefinedOrder);
export {memoizedSortByUserDefinedOrder as SortByUserDefinedOrder};
