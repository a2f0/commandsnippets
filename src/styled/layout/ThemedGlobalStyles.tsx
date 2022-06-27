import GlobalStyles from '@mui/material/GlobalStyles';
import React from 'react';
import {observer} from 'mobx-react';
import {useTheme} from '@mui/material/styles';

const ThemedGlobalStyle = () => {
  const theme = useTheme();
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
