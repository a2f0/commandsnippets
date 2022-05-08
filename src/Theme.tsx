import {darkTheme, lightTheme} from './themes';
import React from 'react';
import {Theme} from '@mui/material/styles';
import {ThemeProvider} from '@mui/material/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';

interface IRootContainerProps {
  children?: React.ReactNode;
}

const Theme = ({children}: IRootContainerProps) => {
  const appConfig = useAppContext();
  let theme: Theme;
  if (appConfig.selectedTheme === 'lightTheme') {
    theme = lightTheme;
  } else {
    theme = darkTheme;
  }
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

export default React.memo(observer(Theme));
