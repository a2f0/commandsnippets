import React, {useState} from 'react';
import {Route, BrowserRouter as Router, Switch} from 'react-router-dom';
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
import ReactDOM from 'react-dom';
import {Redirect} from 'react-router-dom';
import RootContainer from './RootContainer';
import {Theme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import {store} from './AppStateStore';

const AppRouter = React.memo(
  observer(() => {
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
              <DndProvider backend={HTML5Backend}>
                <RootContainer>
                  <Switch>
                    <Route exact path="/oauth/github">
                      {store.loggedInUser ? (
                        <Redirect to={'/' + store.loggedInUser} />
                      ) : (
                        <GithubAuth />
                      )}
                    </Route>
                    <Route exact path="/oauth/google">
                      {store.loggedInUser ? (
                        <Redirect to={'/' + store.loggedInUser} />
                      ) : (
                        <GoogleAuth />
                      )}
                    </Route>
                    <Route path="/:user/:tag">
                      <Main handleThemeSwitcher={handleThemeSwitcher} />
                    </Route>
                    <Route path="/:user">
                      <Main handleThemeSwitcher={handleThemeSwitcher} />
                    </Route>
                    <Route exact path="/">
                      {store.loggedInUser ? (
                        <Redirect to={'/' + store.loggedInUser} />
                      ) : (
                        <PublicHomePage />
                      )}
                    </Route>
                  </Switch>
                </RootContainer>
              </DndProvider>
            </AppContextProvider>
          </Router>
        </ThemeProvider>
      </StyledEngineProvider>
    );
  })
);
ReactDOM.render(<AppRouter />, document.getElementById('©'));
