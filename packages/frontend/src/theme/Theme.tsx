import {ThemeProvider as MuiThemeProvider} from '@mui/material/styles';
import type React from 'react';
import {useAppState} from '../lib/state/appState';
import {darkTheme, lightTheme} from './themes';

interface IThemeProps {
  children?: React.ReactNode;
}

export const ThemeProvider = ({children}: IThemeProps): React.ReactNode => {
  const selectedTheme = useAppState(state => state.selectedTheme);
  return (
    <MuiThemeProvider
      theme={selectedTheme === 'lightTheme' ? lightTheme : darkTheme}
    >
      {children}
    </MuiThemeProvider>
  );
};
