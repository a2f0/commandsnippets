import type {CSSObject, Theme} from '@mui/material/styles';

/** Shared native scrollbar colors, including the window and nested lists. */
export const scrollbarStyles = (theme: Theme): CSSObject => {
  const thumb =
    theme.palette.mode === 'dark'
      ? theme.palette.grey[500]
      : theme.palette.grey[600];
  return {
    // High-contrast modes keep the platform's own scrollbar controls.
    '@media (forced-colors: none)': {
      // The viewport and nested scroll containers inherit the same colors.
      ':root': {scrollbarColor: `${thumb} transparent`},
      // Older Safari/Chromium versions do not support scrollbar-color.
      '@supports not (scrollbar-color: auto)': {
        '*': {
          '&::-webkit-scrollbar': {width: '12px', height: '12px'},
          '&::-webkit-scrollbar-track': {backgroundColor: 'transparent'},
          '&::-webkit-scrollbar-thumb': {
            backgroundColor: thumb,
            backgroundClip: 'padding-box',
            border: '3px solid transparent',
            borderRadius: '6px',
          },
          '&::-webkit-scrollbar-corner': {backgroundColor: 'transparent'},
        },
      },
    },
  };
};
