import {CssBaseline} from '@mui/material';
import {StyledEngineProvider} from '@mui/material/styles';
import React from 'react';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {I18nextProvider} from 'react-i18next';

import {SignOutWarning} from './components/auth/SignOutWarning';
import {ErrorBoundary} from './components/errorBoundary';
import {recordError} from './hooks/useErrorStore';
import {i18n} from './i18n/i18n';
import {Routes} from './Routes';
import {ThemeProvider} from './theme/Theme';
import {MemoizedThemedGlobalStyle} from './theme/ThemedGlobalStyles';

const App = React.memo(() => (
  // What the boundary catches goes to the HUD's error store; the app, the
  // HUD included, then renders nothing until the page reloads.
  <ErrorBoundary onError={recordError}>
    <I18nextProvider i18n={i18n}>
      <StyledEngineProvider injectFirst>
        <ThemeProvider>
          <CssBaseline />
          <MemoizedThemedGlobalStyle />
          <DndProvider backend={HTML5Backend}>
            <Routes />
          </DndProvider>
          <SignOutWarning />
        </ThemeProvider>
      </StyledEngineProvider>
    </I18nextProvider>
  </ErrorBoundary>
));

export {App};
