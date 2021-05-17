import React, { useState} from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import CssBaseline from '@material-ui/core/CssBaseline';
import { makeStyles, MuiThemeProvider } from '@material-ui/core/styles';
import { DndProvider } from 'react-dnd'
import { HTML5Backend } from 'react-dnd-html5-backend'
import { lightTheme, darkTheme } from './themes.js'
import { observable } from "mobx"
import AppContext from './AppContext.js'
import Main from './Main.jsx'
import AppStateStore from './AppStateStore.js'
import {observer} from 'mobx-react';
import GithubAuth from './GithubAuth.jsx'
import GoogleAuth from './GoogleAuth.jsx'
import packageJson from '../package.json';

console.info('Package version: ' + packageJson.version);

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },
}));

const appConfig = observable({
  entrySortOrder: 'order',
  tagSortOrder: 'order',
  authenticatedUser: null,
  loggedInUser: null,
  mainPanel: 'EntryList',
  appStateStore: AppStateStore
})


const AppRouter = React.memo(observer(function AppRouter(props) {
  const classes = useStyles();

  if (appConfig.appStateStore.selectedTheme=='lightTheme') {
    var initialTheme = lightTheme;
  } else {
    var initialTheme = darkTheme;
  }

  const [selectedTheme, setSelectedTheme] = useState(initialTheme);


  const handleThemeSwitcher = (chosenTheme) => {
    if (chosenTheme == lightTheme) {
      appConfig.appStateStore.setSelectedTheme("lightTheme")
    } else {
      appConfig.appStateStore.setSelectedTheme("darkTheme")
    }
    setSelectedTheme(chosenTheme)
  }
  return (
    <Router>
      <AppContext.Provider value={appConfig}>
        <MuiThemeProvider theme={selectedTheme}>
          <CssBaseline />
          <DndProvider backend={HTML5Backend}>
            <div className={classes.root}>
              { appConfig.appStateStore.loggedInUser && (
                <Switch>
                  <Route path="/:user/untagged-entries">
                    <Main handleThemeSwitcher={handleThemeSwitcher}/>
                  </Route>
                  <Route path="/:user/:tag">
                    <Main handleThemeSwitcher={handleThemeSwitcher}/>
                  </Route>
                  <Route path="/:user">
                    <Main handleThemeSwitcher={handleThemeSwitcher}/>
                  </Route>
                  <Route exact path="/">
                    <Main handleThemeSwitcher={handleThemeSwitcher}/>
                  </Route>
                </Switch>
              )}
              { ! appConfig.appStateStore.loggedInUser && (
                <>
                  <GithubAuth/>
                  <GoogleAuth/>
                </>
              )}
            </div>
          </DndProvider>
        </MuiThemeProvider>
      </AppContext.Provider>
    </Router>

  );
}))
ReactDOM.render(<AppRouter />, document.getElementById("©"));
