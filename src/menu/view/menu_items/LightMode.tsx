import {ListItemIcon} from '@mui/material';
import React from 'react';
import StyledCheckIcon from '../../../styled/StyledCheckIcon';
import StyledMenuItem from '../../../StyledMenuItem';
import {Theme} from '@mui/material/styles';
import {lightTheme} from '../../../themes';
import {useAppContext} from '../../../AppContext';

interface IProps {
  onClose: () => void;
}

const LightMode = function ({onClose}: IProps) {
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
