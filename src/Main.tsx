import * as Constants from './constants';
import AppBar from '@mui/material/AppBar';
import EntryList from './EntryList';
import LeftDrawer from './LeftDrawer';
import MenuBar from './MenuBar';
import React from 'react';
import StyledToolbar from './styled/layout/StyledToolbar';
import TagSearch from './TagSearch';
import TextEntrySearchField from './styled/text_entries/TextEntrySearchField';
import {Theme} from '@mui/material/styles';
import makeStyles from '@mui/styles/makeStyles';
import {observer} from 'mobx-react';

const useStyles = makeStyles(() => ({
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
    zIndex: 1000,
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
        <StyledToolbar>
          <MenuBar handleThemeSwitcher={props.handleThemeSwitcher} />
        </StyledToolbar>
      </AppBar>
      <LeftDrawer />
      <main className={classes.main}>
        <EntryList />
      </main>
      <AppBar position="fixed" color="primary" sx={{top: 'auto', bottom: 0}}>
        <StyledToolbar>
          <TagSearch /> <TextEntrySearchField />
        </StyledToolbar>
      </AppBar>
    </>
  );
};
export default React.memo(observer(Main));
