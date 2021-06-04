import {Theme, createMuiTheme} from '@material-ui/core/styles';

const darkBackground = '#0F0F0F';
const darkForeground = '#FFF';

export const darkTheme: Theme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: {
      main: darkBackground,
    },
    background: {
      default: darkBackground,
      paper: darkBackground,
    },
    text: {
      primary: darkForeground,
    },
  },
});

export const lightTheme: Theme = createMuiTheme({
  palette: {
    type: 'light',
    primary: {
      main: '#FFF',
    },
    background: {
      default: '#FFF',
      paper: '#FFF',
    },
    text: {
      primary: '#000',
    },
  },
});
