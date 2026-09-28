import {Box} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useLocation, useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {AppHeader} from './components/AppHeader';
import {BottomToolbar} from './components/BottomToolbar';
import {LeftDrawer} from './drawer/LeftDrawer';
import {RightDrawer} from './drawer/RightDrawer';
import {EntryList} from './EntryList';
import {hasLoginCookie, loggedInCookieNames} from './lib/auth/authUtils';
import {environment} from './lib/environment';

const COOKIE_KEYS = loggedInCookieNames(environment);

const MainContent = () => {
  const location = useLocation();
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [cookies] = useCookies(COOKIE_KEYS);
  const loggedInCookie = hasLoginCookie(cookies, environment);

  // Redirect to user's page when on root path.
  useEffect(() => {
    if (location.pathname === '/' && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  }, [location.pathname, appConfig.loggedInUser, navigate]);

  // If the user has cleared their cookies, log them out from the application state.
  // Note: this is not the Authorization cookie containing the authorization token.
  const handleCookieLogout = useCallback(() => {
    if (!loggedInCookie && appConfig.loggedInUser !== null) {
      console.warn('Cookie logout occurred.');
      appConfig.setLoggedInUser(null);
    }
  }, [loggedInCookie, appConfig.loggedInUser, appConfig.setLoggedInUser]);

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
      <AppHeader />
      <Box
        sx={{
          display: 'flex',
          flex: 1,
          paddingBottom: theme => `${theme.footer.height}px`,
        }}
      >
        <LeftDrawer />
        <EntryList />
        <RightDrawer />
      </Box>
      <BottomToolbar />
    </Box>
  );
};

const MemoizedMainContent = React.memo(observer(MainContent));

const Main = () => {
  return <MemoizedMainContent />;
};

export {Main};
