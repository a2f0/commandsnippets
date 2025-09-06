import {CssBaseline} from '@mui/material';
import {StyledEngineProvider} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';

import './i18n/i18n';
import {Routes} from './Routes';
import {MemoizedThemedGlobalStyle} from './styled/layout/ThemedGlobalStyles';
import {ThemeProvider} from './theme/Theme';

const App = React.memo(
  observer(() => {
    return (
      <StyledEngineProvider injectFirst>
        <ThemeProvider>
          <CssBaseline />
          <MemoizedThemedGlobalStyle />
          <DndProvider backend={HTML5Backend}>
            <Routes />
          </DndProvider>
        </ThemeProvider>
      </StyledEngineProvider>
    );
  })
);

export {App};
