import {CssBaseline} from '@mui/material';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import React from 'react';
import Routes from './Routes';
import {StyledEngineProvider} from '@mui/material/styles';
import Theme from './Theme';
import ThemedGlobalStyle from './styled/layout/ThemedGlobalStyles';
import {observer} from 'mobx-react';

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
