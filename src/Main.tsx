import * as Constants from './constants';
import AppBar from '@mui/material/AppBar';
import EntryList from './EntryList';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import LeftDrawer from './LeftDrawer';
import MenuBar from './MenuBar';
import React from 'react';
import {Theme} from '@mui/material/styles';
import Toolbar from '@mui/material/Toolbar';
import makeStyles from '@mui/styles/makeStyles';
import {observer} from 'mobx-react';

const useStyles = makeStyles(() => ({
  clickableDiv: {
    marginRight: '10px',
    cursor: 'pointer',
  },
  appBar: {
    height: `${Constants.appBarHeight}px`,
    boxShadow: 'none',
    display: 'flex', // Make this a flex container to allow the greedyExpander to gobble up space.
    flexDirection: 'column', // Make this a flex container to allow the greedyExpander to gobble up space.
    backgroundImage: 'none', // Remove the Material UI gradient.
  },
  main: {
    marginTop: `${Constants.appBarHeight}px`,
    height: `calc(100vh - ${Constants.appBarHeight}px - ${Constants.footerHeight}px)`,
    width: `calc(100vw - ${Constants.drawerWidth}px)`,
    overflow: 'auto',
    // Fix overlapping issue with the sticky footer.
    zIndex: 1000,
  },
  positionedTitle: {
    fontSize: '16px',
    position: 'fixed',
    top: '15px',
    left: '8px',
    userSelect: 'none' /* Non-prefixed version, currently */,
    '-webkit-touch-callout': 'none' /* iOS Safari */,
    '-webkit-user-select': 'none' /* Safari */,
    '-khtml-user-select': 'none' /* Konqueror HTML */,
    '-moz-user-select': 'none' /* Old versions of Firefox */,
    '-ms-user-select': 'none' /* Internet Explorer/Edge */,
    cursor: 'pointer',
  },
  positionedTearleads: {
    paddingLeft: '3px',
  },
  greedyExpander: {
    flexGrow: 1,
  },
  list: {
    padding: 0,
  },
  entryListEmptySpace: {
    backgroundColor: 'green',
  },
  title: {
    flexGrow: 1,
  },
}));

interface IMainProps {
  handleThemeSwitcher: (chosenTheme: Theme) => void;
}

const Main = (props: IMainProps) => {
  const classes = useStyles();

  return (
    <>
      <AppBar position="fixed" className={classes.appBar}>
        <MenuBar handleThemeSwitcher={props.handleThemeSwitcher} />
      </AppBar>
      <LeftDrawer />
      <main className={classes.main}>
        <EntryList />
      </main>
      <AppBar position="fixed" color="primary" sx={{top: 'auto', bottom: 0}}>
        <Toolbar variant="dense">
          <GithubAuth />
          <GoogleAuth />
        </Toolbar>
      </AppBar>
    </>
  );
};
export default React.memo(observer(Main));
