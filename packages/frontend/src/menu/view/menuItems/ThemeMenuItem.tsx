import {ListItemIcon} from '@mui/material';
import React from 'react';
import {type MenuKeys, useTypedTranslation} from '../../../i18n/hooks';
import {useAppState} from '../../../lib/state/appState';
import {StyledCheckIcon} from '../../../styled/StyledCheckIcon';
import {StyledMenuItem} from '../../StyledMenuItem';

type ThemeName = 'lightTheme' | 'darkTheme';

const THEMES: Record<ThemeName, {id: string; label: MenuKeys}> = {
  lightTheme: {id: 'view-menu-light-theme', label: 'lightMode'},
  darkTheme: {id: 'view-menu-dark-theme', label: 'darkMode'},
};

interface IProps {
  themeName: ThemeName;
  onClose: () => void;
}

/** View > Light Mode or Dark Mode: checked while it is the theme. */
const ThemeMenuItem = ({themeName, onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const selected = useAppState(state => state.selectedTheme === themeName);
  const {id, label} = THEMES[themeName];

  return (
    <StyledMenuItem
      id={id}
      onClick={() => {
        onClose();
        useAppState.getState().setSelectedTheme(themeName);
      }}
    >
      <ListItemIcon>{selected && <StyledCheckIcon />}</ListItemIcon>
      {t(label)}
    </StyledMenuItem>
  );
};

const memoizedThemeMenuItem = React.memo(ThemeMenuItem);

export {memoizedThemeMenuItem as ThemeMenuItem};
