import React, { useState} from "react";
import ReactDOM from "react-dom";
import { BrowserRouter as Router, Route, Switch } from "react-router-dom";
import CssBaseline from '@material-ui/core/CssBaseline';
import { makeStyles, MuiThemeProvider } from '@material-ui/core/styles';
import { DndProvider } from 'react-dnd'
import Backend from 'react-dnd-html5-backend'
import {lightTheme } from './themes.js'
import { observable } from "mobx"
import AppContext from './AppContext.js'
import Main from './Main.jsx'
import Login from './Login.jsx'
import AppStateStore from './models/AppStateStore.js'
import { destroy, onSnapshot } from "mobx-state-tree"

const localStorageKey = "mst-tearleads"
const initialState = localStorage.getItem(localStorageKey)
  ? JSON.parse(localStorage.getItem(localStorageKey))
  : {
    loggedInUser: ''
  }

let snapshotListener

function createAppStateStore(snapshot) {
  // clean up snapshot listener
  if (snapshotListener) snapshotListener()
  // kill old store to prevent accidental use and run clean up hooks
  if (store) destroy(store)

  // create new one
  store = AppStateStore.create(snapshot)

  // connect local storage
  snapshotListener = onSnapshot(store, (snapshot) =>
    localStorage.setItem(localStorageKey, JSON.stringify(snapshot))
  )

  return store
}

let store = createAppStateStore(initialState)

const appBarHeight = 52;

const useStyles = makeStyles((theme) => ({
  root: {
    display: 'flex',
  },
}));

const appConfig = observable({
  entrySortOrder: 'date_created',
  authenticatedUser: null,
  loggedInUser: null,
  mainPanel: 'EntryList',
  appStateStore: store
})

function AppRouter() {
  const classes = useStyles();
  const [selectedTheme, setSelectedTheme] = useState(lightTheme);
  const handleThemeSwitcher = (chosenTheme) => {
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