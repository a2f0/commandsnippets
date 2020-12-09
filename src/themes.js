import { createMuiTheme } from '@material-ui/core/styles';

const darkBackground = "#0F0F0F"
const darkForeground = "#FFF"

const CUSTOM_SHARED = {
  dragIndicator: {
    display: 'inline-block',
    cursor: 'move',
    verticalAlign: 'top',
    width: '19px',
    height: '19px',
  },
  reuseCount: {
    display: 'inline-block',
    verticalAlign: 'top',
    width: '19px',
    height: '19px',
  }
}

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
  custom: CUSTOM_SHARED
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
  custom: CUSTOM_SHARED
});