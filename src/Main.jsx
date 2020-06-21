import React from 'react'
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
}));

const Main = function (props) {
  const classes = useStyles();
  const handleNavigateToLogin = () => {
    history.push("/login");
  }

  const history = useHistory();

  
  return (
    <>
      <LeftDrawer/>
      <AppBar position="fixed" className={classes.appBar}>
        <Toolbar variant="dense" className={classes.toolBar}>
          <Typography className={classes.title}></Typography>
          <ThemeSwitcher handleThemeSwitcher={props.handleThemeSwitcher}/>
          <Button size="small" className={classes.button} onClick={handleNavigateToLogin}>Login</Button>
        </Toolbar>
        <MenuBar handleThemeSwitcher={props.handleThemeSwitcher}/>
      </AppBar>
      <main className={classes.main}>
        <EntryList/>
      </main>
      {/* <RightDrawer/>  */}
    </>
  )
}
export default Main