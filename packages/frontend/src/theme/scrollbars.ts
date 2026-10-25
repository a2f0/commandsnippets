import type {CSSObject, Theme} from '@mui/material/styles';

/** Shared native scrollbar colors, including the window and nested lists. */
export const scrollbarStyles = (theme: Theme): CSSObject => {
  const thumb =
    theme.palette.mode === 'dark'
      ? theme.palette.grey[500]
      : theme.palette.grey[600];
  const track = theme.palette.background.default;

  return {
    // High-contrast modes keep the platform's own scrollbar controls.
    '@media (forced-colors: none)': {
      scrollbarColor: `${thumb} ${track}`,
      scrollbarWidth: 'auto',
      // Older Safari/Chromium versions do not support scrollbar-color.
      '@supports not (scrollbar-color: auto)': {
        '&::-webkit-scrollbar': {width: '12px', height: '12px'},
        '&::-webkit-scrollbar-track': {backgroundColor: track},
        '&::-webkit-scrollbar-thumb': {
          backgroundColor: thumb,
          border: `3px solid ${track}`,
          borderRadius: '6px',
        },
        '&::-webkit-scrollbar-corner': {backgroundColor: track},
      },
    },
  };
};
