import ListItemIcon from '@mui/material/ListItemIcon';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const LightMode = function ({onClose}: IProps) {
  const appConfig = useAppContext();

  return (
    <StyledMenuItem
      id="view-menu-show-tag-counts"
      onClick={() => {
        appConfig.setShowTagCounts(!appConfig.showTagCounts);
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.showTagCounts === true && <StyledCheckIcon />}
      </ListItemIcon>
      Show Tag Counts
    </StyledMenuItem>
  );
};

export default React.memo(LightMode);
