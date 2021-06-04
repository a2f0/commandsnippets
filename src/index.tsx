import {MuiThemeProvider, makeStyles} from '@material-ui/core/styles';
import React, {useState} from 'react';
import {Route, BrowserRouter as Router, Switch} from 'react-router-dom';
import {darkTheme, lightTheme} from './themes';
import {AppContextProvider} from './AppContext';
import CssBaseline from '@material-ui/core/CssBaseline';
import {DndProvider} from 'react-dnd';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import {HTML5Backend} from 'react-dnd-html5-backend';
import Main from './Main';
import ReactDOM from 'react-dom';
import {Theme} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import packageJson from '../package.json';
import {store} from './AppStateStore';

console.info('Package version: ' + packageJson.version);

const useStyles = makeStyles({
  root: {
    display: 'flex',
  },
});

const AppRouter = React.memo(
  observer(() => {
    const classes = useStyles();
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
      <Router>
        <AppContextProvider>
          <MuiThemeProvider theme={selectedTheme}>
            <CssBaseline />
            <DndProvider backend={HTML5Backend}>
              <div className={classes.root}>
                {store.loggedInUser && (
                  <Switch>
                    <Route path="/:user/untagged-entries">
                      <Main handleThemeSwitcher={handleThemeSwitcher} />
                    </Route>
                    <Route path="/:user/:tag">
                      <Main handleThemeSwitcher={handleThemeSwitcher} />
                    </Route>
                    <Route path="/:user">
                      <Main handleThemeSwitcher={handleThemeSwitcher} />
                    </Route>
                    <Route exact path="/">
                      <Main handleThemeSwitcher={handleThemeSwitcher} />
                    </Route>
                  </Switch>
                )}
                {!store.loggedInUser && (
                  <>
                    <GithubAuth />
                    <GoogleAuth />
                  </>
                )}
              </div>
            </DndProvider>
          </MuiThemeProvider>
        </AppContextProvider>
      </Router>
    );
  })
);
ReactDOM.render(<AppRouter />, document.getElementById('©'));
