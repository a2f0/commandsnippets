import {ListItemIcon} from '@mui/material';
import React from 'react';
import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {lightTheme, type Theme} from '../../../theme/themes';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

const LightMode = ({onClose}: IProps) => {
  const appConfig = useAppContext();
  const {t} = useTypedTranslation('menu');

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
      {t('lightMode')}
    </StyledMenuItem>
  );
};

const memoizedLightMode = React.memo(LightMode);

export {memoizedLightMode as LightMode};
