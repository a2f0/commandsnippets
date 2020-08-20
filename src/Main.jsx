import React, {useState, useContext} from 'react'
import LeftDrawer from './LeftDrawer.jsx'
import AppBar from '@material-ui/core/AppBar';
import Toolbar from '@material-ui/core/Toolbar';
import { makeStyles } from '@material-ui/core/styles';
import Typography from '@material-ui/core/Typography';
import ThemeSwitcher from './ThemeSwitcher.jsx'
import Button from '@material-ui/core/Button';
import MenuBar from './MenuBar.jsx';
import EntryList from './EntryList.jsx'
import { useHistory } from "react-router-dom";
import MainContextMenu from './MainContextMenu.jsx'
import Box from '@material-ui/core/Box';
import {observer} from 'mobx-react';
import AppContext from './AppContext.js'
import UntaggedEntryList from './UntaggedEntryList.jsx'
import RightDrawer from './RightDrawer.jsx'

const appBarHeight = 52;

const useStyles = makeStyles((theme) => ({
  clickableDiv: {
    marginRight: '10px',
    cursor: 'pointer'
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    height: appBarHeight,
    boxShadow: 'none',
    display: 'flex', // Make this a flex container to allow the greedyExpander to gobble up space.
    flexDirection: 'column' // Make this a flex container to allow the greedyExpander to gobble up space.
  },
  main: {	
    flexGrow: 1,
    marginTop: appBarHeight,	
    height: `calc(100vh - ${appBarHeight}px)`,	
    overflow: "auto"
  },
  toolBar: {
    minHeight: 0,
    padding: 0,
  },
  positionedTitle: {
    fontSize: '16px',
    position: 'fixed',
    top: '15px',
    left: '15px',
    userSelect: 'none', /* Non-prefixed version, currently */
    '-webkit-touch-callout': 'none', /* iOS Safari */
    '-webkit-user-select': 'none',   /* Safari */
    '-khtml-user-select': 'none', /* Konqueror HTML */
    '-moz-user-select': 'none', /* Old versions of Firefox */
    '-ms-user-select': 'none', /* Internet Explorer/Edge */
  },
  greedyExpander: {
    flexGrow: 1
  },
  list: {
    padding: 0
  },
  entryListEmptySpace: {
    backgroundColor: "green"
  },
  title: {
    flexGrow: 1,
  },
}));

const Main = React.memo(observer(function Main(props) {
  const appConfig = useContext(AppContext)
  const classes = useStyles();
  const handleNavigateToLogin = () => {
    history.push("/login");
  }

  const history = useHistory();

  const initialMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);

  const handleContextClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    let mouseData = {...mouse}
    mouseData.mouseX = event.clientX - 2,
    mouseData.mouseY = event.clientY - 4,
    setMouse(mouseData)
  };

  const showNewEntry = () => {
    console.log("showNewEntry")
  };
  
  return (
    <>
      <LeftDrawer/>
      <AppBar position="fixed" className={classes.appBar}>
        <div className={classes.greedyExpander}>
          {/* force the menu to be at the bottom of the app bar */}
        </div>
        <Toolbar variant="dense" className={classes.toolBar}>
          <div className={classes.title}>
            {/* Push the login buttons to the right */}
          </div>
          <div className={classes.positionedTitle}>
            <span>
              &#x25cf;
            </span>Tearleads
          </div>
          {/* <ThemeSwitcher handleThemeSwitcher={props.handleThemeSwitcher}/> */}
          { ! appConfig.appStateStore.loggedInUser && (
            <div className={classes.clickableDiv} onClick={handleNavigateToLogin}>Login</div>
          )}
          { appConfig.appStateStore.loggedInUser && (
            <div className={classes.clickableDiv} onClick={handleNavigateToLogin}>{appConfig.appStateStore.loggedInUser}</div>
          )}
        </Toolbar>
        <MenuBar handleThemeSwitcher={props.handleThemeSwitcher}/>
      </AppBar>
      <main className={classes.main}>
        { appConfig.mainPanel == 'UntaggedEntryList' && (
          <UntaggedEntryList/>
        )}
        { appConfig.mainPanel == 'EntryList' && (
          <EntryList/>
        )}
        {/* <Box height="auto" className={classes.entryListBlankSpace}>
          Empty Space
        </Box> */}

      </main>
      {/* <MainContextMenu mouse={mouse} showNewEntry={showNewEntry} /> */}
      {/* <RightDrawer/>  */}
    </>
  )
}))
export default Main