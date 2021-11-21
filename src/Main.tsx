import * as Constants from './constants';
import React, {useEffect} from 'react';
import AppBar from '@mui/material/AppBar';
import EntryList from './EntryList';
import LeftDrawer from './LeftDrawer';
import MenuBar from './MenuBar';
import StyledToolbar from './styled/layout/StyledToolbar';
import TagSearch from './TagSearch';
import TextEntrySearchField from './styled/text_entries/TextEntrySearchField';
import {Theme} from '@mui/material/styles';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useLocation} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';
import {useTheme} from '@mui/styles';

interface IMainProps {
  handleThemeSwitcher: (chosenTheme: Theme) => void;
}

const Main = (props: IMainProps) => {
  const theme: Theme = useTheme();
  const location = useLocation();
  const appConfig = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/' && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  });

  const mainStyle = {
    paddingTop: `${theme.main.paddingTop}rem`,
    marginTop: `${Constants.appBarHeight}px`,
    height: `calc(100vh - ${Constants.appBarHeight}px - ${Constants.footerHeight}px)`,
    width: `calc(100vw - ${Constants.drawerWidth}px)`,
    overflow: 'auto',
    zIndex: 1000,
  };

  return (
    <>
      <AppBar
        position="fixed"
        sx={{
          height: `${Constants.appBarHeight}px`,
          boxShadow: 'none', // Remove the Material UI 'bottom border'.
          backgroundImage: 'none', // Remove the Material UI gradient.
          borderBottom: '1px solid #808080',
          backgroundColor: theme => `${theme.header.background}`,
        }}
      >
        <StyledToolbar>
          <MenuBar handleThemeSwitcher={props.handleThemeSwitcher} />
        </StyledToolbar>
      </AppBar>
      <LeftDrawer />
      <main style={mainStyle}>
        <EntryList />
      </main>
      <AppBar
        position="fixed"
        sx={{
          top: 'auto',
          bottom: 0,
          height: `${Constants.footerHeight}px`,
          backgroundImage: 'none', // Remove the Material UI gradient.
          backgroundColor: theme => `${theme.footer.background}`,
        }}
      >
        <StyledToolbar>
          <TagSearch /> <TextEntrySearchField />
        </StyledToolbar>
      </AppBar>
    </>
  );
};
export default React.memo(observer(Main));
