import React, { useState} from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import CssBaseline from '@material-ui/core/CssBaseline';
import { makeStyles, MuiThemeProvider } from '@material-ui/core/styles';
import { DndProvider } from 'react-dnd'
import Backend from 'react-dnd-html5-backend'
import { lightTheme, darkTheme } from './themes.js'
import { observable } from "mobx"
import AppContext from './AppContext.js'
import Main from './Main.jsx'
import Login from './Login.jsx'
import AppStateStore from './AppStateStore.js'
import { environment } from './api.js'

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

function AppRouter() {
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
          <DndProvider backend={Backend}>
            <div className={classes.root}>
              <Switch>
                <Route path="/login">
                  <Login/>
                </Route>
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
            </div>    
          </DndProvider>
        </MuiThemeProvider>
      </AppContext.Provider>
    </Router>
    
  );
}
ReactDOM.render(<AppRouter />, document.getElementById("©"));