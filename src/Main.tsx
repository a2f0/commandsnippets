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

interface IMainProps {
  handleThemeSwitcher: (chosenTheme: Theme) => void;
}

const Main = (props: IMainProps) => {
  const location = useLocation();
  const appConfig = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    if (location.pathname === '/' && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  });

  // If the user has cleared their cookies, log them out from the application state.
  // Note: this is not the Authorization cookie containing the authorization token.
  useEffect(() => {
    const loggedIn = document.cookie
      .split('; ')
      .find(row => row.startsWith('LoggedIn='));
    if (loggedIn === undefined) {
      if (appConfig.loggedInUser !== null) {
        console.warn('Cookie logout occurred.');
        appConfig.setLoggedInUser(null);
      }
    }
  }, [location]);

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
      <main>
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
