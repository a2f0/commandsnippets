import {Box} from '@mui/material';
import React, {useCallback, useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useLocation, useNavigate, useParams} from 'react-router-dom';
import {AppHeader} from '../components/AppHeader';
import {BottomToolbar} from '../components/bottomBar/BottomToolbar';
import {LeftDrawer} from '../components/drawer/LeftDrawer';
import {RightDrawer} from '../components/drawer/RightDrawer';
import {EntryList} from '../components/entries/EntryList';
import {InitialLoadProgress} from '../components/entries/InitialLoadProgress';
import {hasLoginCookie, loggedInCookieNames} from '../lib/auth/authUtils';
import {useOwner} from '../lib/data/hooks';
import {useCollectionSync} from '../lib/data/useSync';
import {environment} from '../lib/environment';
import {useAppConfig, useAppState} from '../lib/state/appState';

const COOKIE_KEYS = loggedInCookieNames(environment);

const EntriesPageContent = () => {
  const location = useLocation();
  const appConfig = useAppConfig();
  const navigate = useNavigate();
  // Read `document.cookie` afresh on mount: CookiesProvider parsed it when the
  // page loaded, before a sign-in's API answer set the login cookie, and that
  // stale copy would sign the user straight back out.
  const [cookies] = useCookies(COOKIE_KEYS, {doNotUpdate: false});
  const loggedInCookie = hasLoginCookie(cookies, environment);
  // The user's data, from the API into IndexedDB, which the lists show.
  const syncStatus = useCollectionSync();

  // Redirect to user's page when on root path.
  useEffect(() => {
    if (location.pathname === '/' && appConfig.loggedInUser !== null) {
      navigate(`/${appConfig.loggedInUser}`);
    }
  }, [location.pathname, appConfig.loggedInUser, navigate]);

  // Another user's page is for staff (who read that user's data there);
  // anyone else goes to their own.
  const {user} = useParams();
  const owner = useOwner();
  const ownPage = owner === null || owner.readOnly ? null : owner.owner;
  useEffect(() => {
    if (user !== undefined && ownPage !== null && user !== ownPage) {
      navigate(`/${ownPage}`, {replace: true});
    }
  }, [user, ownPage, navigate]);

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
      <InitialLoadProgress {...syncStatus} />
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

/**
 * Each user's page is their own: another signed-in user's (this tab may take
 * up another tab's sign-in), or for staff another user's data, starts
 * afresh, keeping none of the last one's lists, copies or editors while its
 * data loads.
 */
const EntriesPage = () => {
  const loggedInUser = useAppState(state => state.loggedInUser);
  const owner = useOwner()?.owner;
  return (
    <MemoizedEntriesPageContent key={`${loggedInUser ?? ''}:${owner ?? ''}`} />
  );
};

export {EntriesPage};
