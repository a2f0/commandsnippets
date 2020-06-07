import { makeStyles, createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';

const darkBackground = "#202020"
const darkForeground = "#FFF"

export const darkTheme = createMuiTheme({
  palette: {
    type: 'dark',
    primary: {
      main: darkBackground
    },
    background: {
      default: darkBackground,
      paper: darkBackground
    },
    text: {
      primary: darkForeground,
    }
  },
  custom: {
    dragIndicator: {
      display: 'inline-block',
      cursor: 'move',
      verticalAlign: 'top',
      width: 24
    }
  }
})

export const lightTheme = createMuiTheme({
  palette: {
    type: 'light',
    primary: {
      main: "#FFF"
    },
    background: {
      default: '#FFF',
      paper: '#FFF'
    },
    text: {
      primary: '#000',
    }
  },
  custom: {
    dragIndicator: {
      display: 'inline-block',
      cursor: 'move',
      verticalAlign: 'top',
      width: 24
    }
  }
});