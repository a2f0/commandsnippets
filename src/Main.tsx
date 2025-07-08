import {AppBar, Box} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useEffect} from 'react';
import {useLocation} from 'react-router-dom';
import {useNavigate} from 'react-router-dom';
import {useCookies} from 'react-cookie';

import {useAppContext} from './AppContext';
import {LeftDrawer} from './drawer/LeftDrawer';
import {RightDrawer} from './drawer/RightDrawer';
import {EntryList} from './EntryList';
import {BottomBar} from './lib/bottom_bar/BottomBar';
import {MenuBar} from './MenuBar';
import {StyledToolbar} from './styled/layout/StyledToolbar';

const Main = () => {
  const location = useLocation();
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [cookies] = useCookies(['LoggedIn']);

  useEffect(() => {
    if (location.pathname === '/' && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  });

  // If the user has cleared their cookies, log them out from the application state.
  // Note: this is not the Authorization cookie containing the authorization token.
  useEffect(() => {
    if (!cookies.LoggedIn) {
      if (appConfig.loggedInUser !== null) {
        console.warn('Cookie logout occurred.');
        appConfig.setLoggedInUser(null);
      }
    }
  }, [appConfig.loggedInUser, appConfig.setLoggedInUser, cookies.LoggedIn]);

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
          height: theme => `${theme.appBar.height}`,
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
          backgroundColor: theme => theme.palette.background.default,
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

const memoizedMain = React.memo(observer(Main));
export {memoizedMain as Main};
