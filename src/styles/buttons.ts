import type {Theme} from '@mui/material/styles';

export const commonButtonSx = {
  color: (theme: Theme) => theme.palette.text.primary,
  borderColor: (theme: Theme) => theme.palette.text.secondary,
  '&:hover': {
    borderColor: (theme: Theme) => theme.palette.text.primary,
  },
};
