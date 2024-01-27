import {Theme, createTheme} from '@mui/material/styles';
import {defaultThemeOptions} from './themeBase';

const dark = '#0F0F0F';

export const darkTheme: Theme = createTheme({
  ...defaultThemeOptions,
  palette: {
    mode: 'dark',
  },
  shape: {
    borderRadius: 0,
  },
  //
  selected: {
    foreground: '#ffffff',
    background: '#484848',
  },
  header: {
    background: '#181818',
    menuButtonHighlight: '#808080',
  },
  components: {
    MuiMenu: {
      styleOverrides: {
        list: {
          padding: 0,
          background: dark,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        root: {
          width: `${defaultThemeOptions.drawer.width}px`,
        },
        paper: {
          marginTop: `${defaultThemeOptions.appBar.height}px`,
          borderRight: 0,
          borderLeft: 0,
          width: `${defaultThemeOptions.drawer.width}px`,
          overflow: 'hidden',
          flexShrink: 0,
          marginBottom: defaultThemeOptions.footer.height,
          height: `calc(100vh - ${defaultThemeOptions.appBar.height}px - ${defaultThemeOptions.footer.height}px)`,
          zIndex: 1000,
        },
      },
    },
  },
});

export const lightTheme: Theme = createTheme({
  ...defaultThemeOptions,
  palette: {
    mode: 'light',
  },
  shape: {
    borderRadius: 0,
  },
  //
  selected: {
    foreground: '#101010',
    background: '#e8e8e8',
  },
  header: {
    background: '#dcdcdc',
    menuButtonHighlight: '#696969',
  },
  components: {
    MuiMenu: {
      styleOverrides: {
        list: {
          padding: 0,
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          backgroundImage: 'none',
        },
      },
    },
    MuiDrawer: {
      styleOverrides: {
        root: {
          width: `${defaultThemeOptions.drawer.width}px`,
        },
        paper: {
          marginTop: `${defaultThemeOptions.appBar.height}px`,
          borderRight: 0,
          borderLeft: 0,
          width: `${defaultThemeOptions.drawer.width}px`,
          overflow: 'hidden',
          flexShrink: 0,
          marginBottom: defaultThemeOptions.footer.height,
          height: `calc(100vh - ${defaultThemeOptions.appBar.height}px - ${defaultThemeOptions.footer.height}px)`,
          zIndex: 1000,
        },
      },
    },
  },
});
