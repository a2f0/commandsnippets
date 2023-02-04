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

export default React.memo(SortByUserDefinedOrder);
