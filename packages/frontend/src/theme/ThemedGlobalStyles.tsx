import {GlobalStyles} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React from 'react';

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

export const MemoizedThemedGlobalStyle = React.memo(ThemedGlobalStyle);
