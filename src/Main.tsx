import {AppBar, Box} from '@mui/material';
import {observer} from 'mobx-react';
import React, {useCallback, useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useLocation, useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {BottomToolbar} from './components/BottomToolbar';
import {SafeAreaProvider, useSafeArea} from './components/SafeAreaProvider';
import {LeftDrawer} from './drawer/LeftDrawer';
import {RightDrawer} from './drawer/RightDrawer';
import {EntryList} from './EntryList';
import {MenuBar} from './MenuBar';
import {StyledToolbar} from './styled/layout/StyledToolbar';

const COOKIE_KEY = 'LoggedIn';
const BORDER_COLOR = '#808080';

const MainContent = () => {
  const location = useLocation();
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [cookies] = useCookies([COOKIE_KEY]);
  const {insets, isNativePlatform} = useSafeArea();

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
          height: theme =>
            `${theme.appBar.height + (isNativePlatform ? insets.top : 0)}px`,
          paddingTop: isNativePlatform ? `${insets.top}px` : 0,
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
  return (
    <SafeAreaProvider>
      <MemoizedMainContent />
    </SafeAreaProvider>
  );
};

export {Main};
