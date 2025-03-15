import {ListItemIcon} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {lightTheme} from '../../../theme/themes';

interface IProps {
  onClose: () => void;
}

const LightMode = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  const handleThemeSwitcher = (chosenTheme: Theme) => {
    if (chosenTheme === lightTheme) {
      appConfig.setSelectedTheme('lightTheme');
    } else {
      appConfig.setSelectedTheme('darkTheme');
    }
  };

  return (
    <StyledMenuItem
      id="view-menu-light-theme"
      onClick={() => {
        handleThemeSwitcher(lightTheme);
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.selectedTheme === 'lightTheme' && <StyledCheckIcon />}
      </ListItemIcon>
      Light Mode
    </StyledMenuItem>
  );
};

export default React.memo(LightMode);
