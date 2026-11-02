import type {SxProps, Theme} from '@mui/material/styles';

/** The menu bar's text-button look, also used by its plain links. */
export const menuBarButtonSx: SxProps<Theme> = {
  alignSelf: 'flex-end',
  textTransform: 'none',
  padding: 0,
  minWidth: 0,
  marginRight: 2,
  '&:active': {
    backgroundColor: '#585858',
  },
  '&.MuiButton-root': {
    color: theme => theme.palette.text.primary,
    '&:hover': {
      background: 'none',
      color: theme => theme.palette.text.secondary,
    },
  },
};
