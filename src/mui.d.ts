import { Theme as MuiTheme } from '@mui/material/styles';
import { Theme as CustomTheme } from '@tearleads/theme';

declare module '@mui/material/styles' {
  interface Theme extends CustomTheme {}
  interface ThemeOptions extends CustomTheme {}
}
