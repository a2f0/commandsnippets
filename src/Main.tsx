import * as Constants from './constants';
import {useHistory, useParams} from 'react-router-dom';
import AppBar from '@material-ui/core/AppBar';
import EntryList from './EntryList';
import GithubAuth from './GithubAuth';
import GoogleAuth from './GoogleAuth';
import LeftDrawer from './LeftDrawer';
import MenuBar from './MenuBar';
import React from 'react';
import {Theme} from '@material-ui/core/styles';
import Toolbar from '@material-ui/core/Toolbar';
// import UntaggedEntryList from './UntaggedEntryList';
import {makeStyles} from '@material-ui/core/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';

const appBarHeight = 52;

const useStyles = makeStyles(theme => ({
  clickableDiv: {
    marginRight: '10px',
    cursor: 'pointer',
  },
  appBar: {
    zIndex: theme.zIndex.drawer + 1,
    height: appBarHeight,
    boxShadow: 'none',
    display: 'flex', // Make this a flex container to allow the greedyExpander to gobble up space.
    flexDirection: 'column', // Make this a flex container to allow the greedyExpander to gobble up space.
  },
  main: {
    flexGrow: 1,
    marginTop: appBarHeight,
    height: `calc(100vh - ${Constants.appBarHeight}px)`,
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
  const appConfig = useAppContext();
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
        {/* {appConfig.mainPanel === 'UntaggedEntryList' && <UntaggedEntryList />} */}
        {appConfig.mainPanel === 'EntryList' && <EntryList />}
        {/* <Box height="auto" className={classes.entryListBlankSpace}>
          Empty Space
        </Box> */}
      </main>
      {/* <MainContextMenu mouse={mouse} showNewEntry={showNewEntry} /> */}
    </>
  );
};
export default React.memo(observer(Main));
