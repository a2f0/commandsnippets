import {ListItemIcon} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import React from 'react';

import {useAppContext} from '../../../AppContext';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {darkTheme} from '../../../theme/themes';

interface IProps {
  onClose: () => void;
}

const DarkMode = ({onClose}: IProps) => {
  const appConfig = useAppContext();

  const handleThemeSwitcher = (chosenTheme: Theme) => {
    if (chosenTheme === darkTheme) {
      appConfig.setSelectedTheme('darkTheme');
    } else {
      appConfig.setSelectedTheme('lightTheme');
    }
  };

  return (
    <StyledMenuItem
      id="view-menu-dark-theme"
      onClick={() => {
        handleThemeSwitcher(darkTheme);
        onClose();
      }}
    >
      <ListItemIcon>
        {appConfig.selectedTheme === 'darkTheme' && <StyledCheckIcon />}
      </ListItemIcon>
      Dark Mode
    </StyledMenuItem>
  );
};

export default React.memo(DarkMode);
