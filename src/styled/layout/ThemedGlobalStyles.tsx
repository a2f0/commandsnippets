import GlobalStyles from '@mui/material/GlobalStyles';
import React from 'react';
import {Theme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import {useTheme} from '@mui/styles';

const ThemedGlobalStyle = () => {
  const theme: Theme = useTheme();
  return (
    <GlobalStyles
      styles={{
        '::selection': {background: theme.selected.background},
        '::-webkit-selection': {background: theme.selected.background},
        '::-moz-selection': {background: theme.selected.background},
      }}
    />
  );
};

export default React.memo(observer(ThemedGlobalStyle));
