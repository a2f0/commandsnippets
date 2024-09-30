import {Theme as MuiTheme} from '@mui/material/styles';
import {ThemeProvider} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';

import {useAppContext} from '../AppContext';
import {darkTheme, lightTheme} from './themes';

interface IThemeProps {
  children?: React.ReactNode;
}

const Theme = ({children}: IThemeProps) => {
  const appConfig = useAppContext();
  let theme: MuiTheme;
  if (appConfig.selectedTheme === 'lightTheme') {
    theme = lightTheme;
  } else {
    theme = darkTheme;
  }
  return <ThemeProvider theme={theme}>{children}</ThemeProvider>;
};

export default React.memo(observer(Theme));
