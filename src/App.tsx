import {CssBaseline} from '@mui/material';
import {StyledEngineProvider} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';

import {Routes} from './Routes';
import {MemoizedThemedGlobalStyle} from './styled/layout/ThemedGlobalStyles';
import {ThemeProvider} from './theme/Theme';
import {ErrorBoundary} from './components/ErrorBoundary';

const App = React.memo(
  observer(() => {
    return (
      <ErrorBoundary>
        <StyledEngineProvider injectFirst>
          <ThemeProvider>
            <CssBaseline />
            <MemoizedThemedGlobalStyle />
            <DndProvider backend={HTML5Backend}>
              <Routes />
            </DndProvider>
          </ThemeProvider>
        </StyledEngineProvider>
      </ErrorBoundary>
    );
  })
);

export {App};
