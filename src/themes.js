import { makeStyles, createMuiTheme, MuiThemeProvider } from '@material-ui/core/styles';

const darkBackground = "#202020"
const darkForeground = "#FFF"

const baseTheme = createMuiTheme({
  custom: {
    dragIndicator: {
      display: 'inline-block',
      cursor: 'move',
      verticalAlign: 'top',
      width: 24
    }
  }
})

export const darkTheme = createMuiTheme(baseTheme, {
  palette: {
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
  }
});

export const lightTheme = createMuiTheme(baseTheme, {
  palette: {
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
});