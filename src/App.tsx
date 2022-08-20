import {AppContextProvider} from './AppContext';
import CssBaseline from '@mui/material/CssBaseline';
import {DndProvider} from 'react-dnd';
import {HTML5Backend} from 'react-dnd-html5-backend';
import React from 'react';
import Routes from './Routes';
import {StyledEngineProvider} from '@mui/material/styles';
import Theme from './Theme';
import ThemedGlobalStyle from './styled/layout/ThemedGlobalStyles';
import {observer} from 'mobx-react';
import packageJson from '../package.json';

const App = React.memo(
  observer(() => {
    console.info(`v${packageJson.version}`);
    return (
      <StyledEngineProvider injectFirst>
        <AppContextProvider>
          <Theme>
            <CssBaseline />
            <ThemedGlobalStyle />
            <DndProvider backend={HTML5Backend}>
              <Routes />
            </DndProvider>
          </Theme>
        </AppContextProvider>
      </StyledEngineProvider>
    );
  })
);

export default App;
