import {CssBaseline} from '@mui/material';
import {StyledEngineProvider} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import {I18nextProvider} from 'react-i18next';

import {ErrorBoundary, type ErrorInfo} from './components/ErrorBoundary';
import {getGlobalErrorStore} from './hooks/useErrorStore';
import {i18n} from './i18n/i18n';
import {ErrorStoreProvider} from './providers/ErrorStoreProvider';
import {Routes} from './Routes';
import {MemoizedThemedGlobalStyle} from './styled/layout/ThemedGlobalStyles';
import {ThemeProvider} from './theme/Theme';

const App = React.memo(
  observer(() => {
    const handleError = (errorInfo: ErrorInfo) => {
      const store = getGlobalErrorStore();
      if (store) {
        store.addError(errorInfo);
      }
    };

    return (
      <ErrorStoreProvider>
        <ErrorBoundary onError={handleError}>
          <I18nextProvider i18n={i18n}>
            <StyledEngineProvider injectFirst>
              <ThemeProvider>
                <CssBaseline />
                <MemoizedThemedGlobalStyle />
                <DndProvider backend={HTML5Backend}>
                  <Routes />
                </DndProvider>
              </ThemeProvider>
            </StyledEngineProvider>
          </I18nextProvider>
        </ErrorBoundary>
      </ErrorStoreProvider>
    );
  })
);

export {App};
