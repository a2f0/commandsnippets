import {ListItemIcon} from '@mui/material';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../../StyledMenuItem';
import {lightTheme, type Theme} from '@tearleads/theme';

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

const memoizedLightMode = React.memo(LightMode);
export {memoizedLightMode as LightMode};
