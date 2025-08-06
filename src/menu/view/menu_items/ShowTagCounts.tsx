import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const ShowTagCounts = ({onClose}: IProps) => {
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

const memoizedShowTagCounts = React.memo(ShowTagCounts);
export {memoizedShowTagCounts as ShowTagCounts};
