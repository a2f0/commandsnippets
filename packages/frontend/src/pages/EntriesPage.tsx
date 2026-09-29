import {Box} from '@mui/material';
import React, {useCallback, useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useLocation, useNavigate} from 'react-router-dom';
import {AppHeader} from '../components/AppHeader';
import {BottomToolbar} from '../components/bottomBar/BottomToolbar';
import {LeftDrawer} from '../components/drawer/LeftDrawer';
import {RightDrawer} from '../components/drawer/RightDrawer';
import {EntryList} from '../components/entries/EntryList';
import {hasLoginCookie, loggedInCookieNames} from '../lib/auth/authUtils';
import {useCollectionSync} from '../lib/data/useSync';
import {environment} from '../lib/environment';
import {useAppConfig} from '../lib/state/appState';

const COOKIE_KEYS = loggedInCookieNames(environment);

const EntriesPageContent = () => {
  const location = useLocation();
  const appConfig = useAppConfig();
  const navigate = useNavigate();
  const [cookies] = useCookies(COOKIE_KEYS);
  const loggedInCookie = hasLoginCookie(cookies, environment);
  // The user's data, from the API into IndexedDB, which the lists show.
  useCollectionSync();

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

const MemoizedEntriesPageContent = React.memo(EntriesPageContent);

const EntriesPage = () => {
  return <MemoizedEntriesPageContent />;
};

export {EntriesPage};
