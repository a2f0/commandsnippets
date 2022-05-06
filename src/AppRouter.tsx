import React, {useState} from 'react';
import {Route, BrowserRouter as Router, Routes} from 'react-router-dom';
import {StyledEngineProvider, ThemeProvider} from '@mui/material/styles';
import {darkTheme, lightTheme} from './themes';
import {AppContextProvider} from './AppContext';
import CssBaseline from '@mui/material/CssBaseline';
import {DndProvider} from 'react-dnd';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {HTML5Backend} from 'react-dnd-html5-backend';
import Main from './Main';
import PublicHomePage from './PublicHomePage';
import RootContainer from './RootContainer';
import {Theme} from '@mui/material/styles';
import ThemedGlobalStyle from './styled/layout/ThemedGlobalStyles';
import {observer} from 'mobx-react';
import packageJson from '../package.json';
import {store} from './AppStateStore';

const AppRouter = React.memo(
  observer(() => {
    console.info(`v${packageJson.version}`);
    let initialTheme = darkTheme;
    if (store.selectedTheme === 'lightTheme') {
      initialTheme = lightTheme;
    }

    const [selectedTheme, setSelectedTheme] = useState(initialTheme);

    const handleThemeSwitcher = (chosenTheme: Theme) => {
      if (chosenTheme === lightTheme) {
        store.setSelectedTheme('lightTheme');
      } else {
        store.setSelectedTheme('darkTheme');
      }
      setSelectedTheme(chosenTheme);
    };
    return (
      <StyledEngineProvider injectFirst>
        <ThemeProvider theme={selectedTheme}>
          <Router>
            <AppContextProvider>
              <CssBaseline />
              <ThemedGlobalStyle />
              <DndProvider backend={HTML5Backend}>
                <RootContainer>
                  <Routes>
                    <Route path="/oauth/github" element={<GithubAuth />} />
                    <Route path="/oauth/google" element={<GoogleAuth />} />
                    <Route
                      path="/:user/:tag"
                      element={
                        <Main handleThemeSwitcher={handleThemeSwitcher} />
                      }
                    />
                    <Route
                      path="/:user"
                      element={
                        <Main handleThemeSwitcher={handleThemeSwitcher} />
                      }
                    />
                    {store.loggedInUser ? (
                      <Route
                        path="/"
                        element={
                          <Main handleThemeSwitcher={handleThemeSwitcher} />
                        }
                      />
                    ) : (
                      <Route path="/" element={<PublicHomePage />} />
                    )}
                  </Routes>
                </RootContainer>
              </DndProvider>
            </AppContextProvider>
          </Router>
        </ThemeProvider>
      </StyledEngineProvider>
    );
  })
);

export default AppRouter;
