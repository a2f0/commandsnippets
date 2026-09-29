import {ListItemIcon} from '@mui/material';

import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {darkTheme, type Theme} from '../../../theme/themes';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const DarkMode = ({onClose}: IProps) => {
  const appConfig = useAppConfig();
  const {t} = useTypedTranslation('menu');

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
      {t('darkMode')}
    </StyledMenuItem>
  );
};

const memoizedDarkMode = React.memo(DarkMode);

export {memoizedDarkMode as DarkMode};
