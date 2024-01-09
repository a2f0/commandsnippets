import {GlobalStyles} from '@mui/material';
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
        '#©': {
          height: '100%',
        },
      }}
    />
  );
};

export default React.memo(observer(ThemedGlobalStyle));
