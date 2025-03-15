import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const LightMode = ({onClose}: IProps) => {
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
