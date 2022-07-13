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
    footer: {
      background: string;
    };
    main: {
      paddingTop: 0.25;
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
    footer?: {
      background: string;
    };
    main: {
      paddingTop: number;
    };
  }
}

const themeBase = createTheme({
  main: {
    paddingTop: 0.25,
  },
});

export default themeBase;
