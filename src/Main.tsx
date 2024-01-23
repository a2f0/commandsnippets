import {AppBar, Box} from '@mui/material';
import React, {useEffect} from 'react';
import BottomBar from './lib/bottom_bar/BottomBar';
import EntryList from './EntryList';
import LeftDrawer from './drawer/LeftDrawer';
import MenuBar from './MenuBar';
import RightDrawer from './drawer/RightDrawer';
import StyledToolbar from './styled/layout/StyledToolbar';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useLocation} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';

const Main = () => {
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
        position="sticky"
        sx={{
          boxShadow: 'none', // Remove the Material UI 'bottom border'.
          backgroundImage: 'none', // Remove the Material UI gradient.
          borderBottom: '1px solid #808080',
          backgroundColor: theme => `${theme.header.background}`,
          top: 0,
        }}
      >
        <StyledToolbar>
          <MenuBar />
        </StyledToolbar>
      </AppBar>
      <Box
        display="flex"
        flex-direction="column"
        sx={{
          minHeight: '100vh',
        }}
      >
        <LeftDrawer />
        <EntryList />
        <RightDrawer />
      </Box>
      <AppBar
        position="sticky"
        sx={{
          bottom: 0,
          backgroundImage: 'none', // Remove the Material UI gradient.
        }}
      >
        <StyledToolbar>
          <BottomBar />
        </StyledToolbar>
      </AppBar>
    </>
  );
};
export default React.memo(observer(Main));
