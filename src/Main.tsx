import * as Constants from './constants';
import {useHistory, useParams} from 'react-router-dom';
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

const appBarHeight = 52;

const useStyles = makeStyles(() => ({
  clickableDiv: {
    marginRight: '10px',
    cursor: 'pointer',
  },
  appBar: {
    height: appBarHeight,
    boxShadow: 'none',
    display: 'flex', // Make this a flex container to allow the greedyExpander to gobble up space.
    flexDirection: 'column', // Make this a flex container to allow the greedyExpander to gobble up space.
    backgroundImage: 'none', // Remove the Material UI gradient.
  },
  main: {
    flexGrow: 1,
    marginTop: appBarHeight,
    height: `calc(100vh - ${Constants.appBarHeight}px - ${Constants.footerHeight}px)`,
    overflow: 'auto',
  },
  toolBar: {
    minHeight: 0,
    padding: 0,
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

interface IParamTypes {
  user: string;
  tag: string;
}

const Main = (props: IMainProps) => {
  const classes = useStyles();
  const history = useHistory();
  const {user} = useParams<IParamTypes>();

  const handleNavigateToRoot = (user: string) => {
    history.push(`/${user}`);
  };

  return (
    <>
      <AppBar position="fixed" className={classes.appBar}>
        <div className={classes.greedyExpander}>
          {/* force the menu to be at the bottom of the app bar */}
        </div>
        <Toolbar variant="dense" className={classes.toolBar}>
          <div className={classes.title}>
            {/* Push the login buttons to the right */}
          </div>
          <div
            className={classes.positionedTitle}
            onClick={() => {
              handleNavigateToRoot(user);
            }}
          >
            <span>&#x25cf;</span>
            <span className={classes.positionedTearleads}>Tearleads</span>
          </div>
          <GithubAuth />
          <GoogleAuth />
        </Toolbar>
        <MenuBar handleThemeSwitcher={props.handleThemeSwitcher} />
      </AppBar>
      <LeftDrawer />
      <main className={classes.main}>
        <EntryList />
      </main>
      <AppBar position="fixed" color="primary" sx={{top: 'auto', bottom: 0}}>
        <Toolbar variant="dense" className={classes.toolBar}>
          <GithubAuth />
          <GoogleAuth />
        </Toolbar>
      </AppBar>
    </>
  );
};
export default React.memo(observer(Main));
