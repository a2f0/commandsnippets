import type {ThemeOptions} from '@mui/material/styles';

declare module '@mui/material/styles' {
  interface Theme {
    selected: {
      foreground: string;
      background: string;
    };
    header: {
      background: string;
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

const defaultThemeOptions: ThemeOptions = {
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
};

export {defaultThemeOptions};
