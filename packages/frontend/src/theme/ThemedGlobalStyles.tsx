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
        // The browser's own focus ring and form controls are blue: gray
        // them, as the rest of the app.
        ':root': {accentColor: theme.palette.text.primary},
        ':focus-visible': {outlineColor: theme.palette.text.primary},
        '#©': {
          height: '100%',
        },
      }}
    />
  );
};

export const MemoizedThemedGlobalStyle = React.memo(ThemedGlobalStyle);
