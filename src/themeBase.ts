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
    main: {
      paddingTop: number;
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
    main: {
      paddingTop: number;
    };
    footer: {
      height: number;
    };
  }
}

const themeBase = createTheme({
  appBar: {
    height: 52,
  },
  main: {
    paddingTop: 0.25,
  },
  footer: {
    height: 46,
  },
});

export default themeBase;
