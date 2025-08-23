import {AppBar, Box} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useLocation, useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {BottomToolbar} from './components/BottomToolbar';
import {LeftDrawer} from './drawer/LeftDrawer';
import {RightDrawer} from './drawer/RightDrawer';
import {EntryList} from './EntryList';
import {MenuBar} from './MenuBar';
import {StyledToolbar} from './styled/layout/StyledToolbar';

const COOKIE_KEY = 'LoggedIn';
const BORDER_COLOR = '#808080';

const Main = () => {
  const location = useLocation();
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [cookies] = useCookies([COOKIE_KEY]);

  // Redirect to user's page when on root path.
  useEffect(() => {
    if (location.pathname === '/' && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  }, [location.pathname, appConfig.loggedInUser, navigate]);

  // If the user has cleared their cookies, log them out from the application state.
  // Note: this is not the Authorization cookie containing the authorization token.
  const handleCookieLogout = useCallback(() => {
    if (!cookies[COOKIE_KEY] && appConfig.loggedInUser !== null) {
      console.warn('Cookie logout occurred.');
      appConfig.setLoggedInUser(null);
    }
  }, [cookies[COOKIE_KEY], appConfig.loggedInUser, appConfig.setLoggedInUser]);

  useEffect(() => {
    handleCookieLogout();
  }, [handleCookieLogout]);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
      }}
    >
      <AppBar
        position="sticky"
        sx={{
          boxShadow: 'none',
          backgroundImage: 'none',
          borderBottom: `1px solid ${BORDER_COLOR}`,
          backgroundColor: theme => theme.header.background,
          top: 0,
          height: theme => theme.appBar.height,
        }}
      >
        <StyledToolbar>
          <MenuBar />
        </StyledToolbar>
      </AppBar>
      <Box
        sx={{
          display: 'flex',
          flex: 1,
        }}
      >
        <LeftDrawer />
        <EntryList />
        <RightDrawer />
      </Box>
      <Box
        sx={{
          position: 'relative',
          zIndex: theme => theme.zIndex.drawer + 1,
        }}
      >
        <BottomToolbar />
      </Box>
    </Box>
  );
};

const memoizedMain = React.memo(observer(Main));
export {memoizedMain as Main};
