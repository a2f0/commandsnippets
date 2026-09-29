import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const ShowTagCounts = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
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
