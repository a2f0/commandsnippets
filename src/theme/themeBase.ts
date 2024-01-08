import {createTheme} from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    selected: {
      foreground: string;
      background: string;
    };
    header: {
      background: string;
      menuButtonHighlight: string;
    };
    appBar: {
      height: number;
    };
    drawer: {
      width: number;
    };
    main: {
      paddingTop: number;
      dragIndicatorWidth: number;
    };
    footer: {
      height: number;
    };
  }
  // allow configuration using `createTheme`
  interface ThemeOptions {
    selected?: {
      foreground?: string;
      background?: string;
    };
    header?: {
      background: string;
      menuButtonHighlight: string;
    };
    appBar: {
      height: number;
    };
    drawer: {
      width: number;
    };
    main: {
      paddingTop: number;
      dragIndicatorWidth: number;
    };
    footer: {
      height: number;
    };
  }
}

const themeBase = createTheme({
  typography: {
    button: {
      textTransform: 'none',
    },
  },
  appBar: {
    height: 52,
  },
  drawer: {
    width: 160,
  },
  main: {
    paddingTop: 0.25,
    dragIndicatorWidth: 15,
  },
  footer: {
    height: 46,
  },
});

export default themeBase;
