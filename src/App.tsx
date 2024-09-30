import {CssBaseline} from '@mui/material';
import {StyledEngineProvider} from '@mui/material/styles';
import {observer} from 'mobx-react';
import React from 'react';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';

import Routes from './Routes';
import ThemedGlobalStyle from './styled/layout/ThemedGlobalStyles';
import Theme from './theme/Theme';

const App = React.memo(
  observer(() => {
    return (
      <StyledEngineProvider injectFirst>
        <Theme>
          <CssBaseline />
          <ThemedGlobalStyle />
          <DndProvider backend={HTML5Backend}>
            <Routes />
          </DndProvider>
        </Theme>
      </StyledEngineProvider>
    );
  })
);

export default App;
