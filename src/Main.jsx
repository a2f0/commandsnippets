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

const appBarHeight = 52;

const useStyles = makeStyles((theme) => ({
  button: {
    textTransform: 'none'
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    height: appBarHeight
  },
  main: {	
    width: "100%",	
    marginTop: appBarHeight,	
    height: `calc(100vh - ${appBarHeight}px)`,	
    overflow: "auto"
  },
  toolBar: {
    minHeight: 0,
    padding: 0,
  },
  title: {
    flexGrow: 1,
  },
  list: {	
    padding: 0	
  },
  entryListEmptySpace: {
    backgroundColor: "green"
  }
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
        <Toolbar variant="dense" className={classes.toolBar}>
          <Typography className={classes.title}></Typography>
          <ThemeSwitcher handleThemeSwitcher={props.handleThemeSwitcher}/>
          { ! appConfig.loggedInUser && (
            <Button size="small" className={classes.button} onClick={handleNavigateToLogin}>Login</Button>
          )}
          { appConfig.loggedInUser && (
            <Button size="small" className={classes.button} onClick={handleNavigateToLogin}>{appConfig.loggedInUser}</Button>
          )}
        </Toolbar>
        <MenuBar handleThemeSwitcher={props.handleThemeSwitcher}/>
      </AppBar>
      <main className={classes.main}>
        <UntaggedEntryList/>
        <EntryList/>
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