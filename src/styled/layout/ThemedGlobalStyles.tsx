import {GlobalStyles} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';

const ThemedGlobalStyle = () => {
  const theme = useTheme();
  return (
    <GlobalStyles
      styles={{
        '::selection': {
          background:
            theme.selected.background ||
            theme.palette.action?.selected ||
            'rgba(255, 255, 255, 0.08)',
        },
        '::-webkit-selection': {
          background:
            theme.selected.background ||
            theme.palette.action?.selected ||
            'rgba(255, 255, 255, 0.08)',
        },
        '#©': {
          height: '100%',
        },
      }}
    />
  );
};

export const MemoizedThemedGlobalStyle = React.memo(
  observer(ThemedGlobalStyle)
);
