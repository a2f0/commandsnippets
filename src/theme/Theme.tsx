import {ThemeProvider as MuiThemeProvider} from '@mui/material/styles';
import type React from 'react';
import {useAppContext} from '../AppContext';
import {darkTheme, lightTheme} from './themes';

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
