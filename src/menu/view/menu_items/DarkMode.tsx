import {ListItemIcon} from '@mui/material';

import React from 'react';

import {darkTheme, type Theme} from '@tearleads/theme';

import {useAppContext} from '../../../AppContext';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../../StyledMenuItem';

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

const memoizedDarkMode = React.memo(DarkMode);
export {memoizedDarkMode as DarkMode};
