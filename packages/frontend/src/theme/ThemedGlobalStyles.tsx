import '../../../../assets/brand/selection.css';
import {GlobalStyles} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import React from 'react';
import {scrollbarStyles} from './scrollbars';

const ThemedGlobalStyle = () => {
  const theme = useTheme();
  return (
    <GlobalStyles
      styles={{
        ...scrollbarStyles(theme),
        // The browser's own focus ring and form controls are blue: gray
        // them, as the rest of the app.
        ':root': {
          accentColor: theme.palette.text.primary,
          '--text-selection-background': `var(--text-selection-${theme.palette.mode}-background)`,
          '--text-selection-color': `var(--text-selection-${theme.palette.mode}-color)`,
        },
        ':focus-visible': {outlineColor: theme.palette.text.primary},
        '#©': {
          height: '100%',
        },
      }}
    />
  );
};

export const MemoizedThemedGlobalStyle = React.memo(ThemedGlobalStyle);
