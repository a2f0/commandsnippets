// biome-ignore lint: style/useImportType
import React from 'react';
import {darkTheme, lightTheme} from './themes';
import {ThemeProvider as MuiThemeProvider} from '@mui/material/styles';

import {useAppContext} from '../AppContext';

interface IThemeProps {
  children?: React.ReactNode;
}

export const ThemeProvider = ({children}: IThemeProps): React.ReactNode => {
  const appConfig = useAppContext();
  if (appConfig.selectedTheme === 'lightTheme') {
    return <MuiThemeProvider theme={lightTheme}>{children}</MuiThemeProvider>;
  }
  return <MuiThemeProvider theme={darkTheme}>{children}</MuiThemeProvider>;
};
