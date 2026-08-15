import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';

interface IProps {
  onClose: () => void;
}

const ShowTagCounts = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

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
      {t('showTagCounts')}
    </StyledMenuItem>
  );
};

const memoizedShowTagCounts = React.memo(ShowTagCounts);
export {memoizedShowTagCounts as ShowTagCounts};
