import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';
import {useAppContext} from '../../AppContext';
import {useOAuth} from '../../hooks/useOAuth';
import {getOAuthRedirectUrl} from '../../lib/oauth';
import {LoginButton} from './LoginButton';

// Get Google Client ID for web
const getGoogleClientID = () => {
  return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
};

const GoogleAuth = () => {
  const appConfig = useAppContext();

  // OAuth configuration for web
  const oauthConfig = {
    provider: 'google' as const,
    clientId: getGoogleClientID(),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    scopeCheck: (scope: string | null) =>
      scope?.includes('https://www.googleapis.com/auth/userinfo.email') ??
      false,
    redirectUrl: getOAuthRedirectUrl('google'),
  };

  const {initiateLogin, isOAuthInProgress} = useOAuth(oauthConfig);

  const isLoggedIn = appConfig.loggedInUser !== null;

  return (
    <>
      {!isLoggedIn && !isOAuthInProgress && (
        <LoginButton
          id="googleAuthButton"
          onClick={initiateLogin}
          startIcon={<Google />}
        >
          Login with Google
        </LoginButton>
      )}
    </>
  );
};

const memoizedGoogleAuth = React.memo(observer(GoogleAuth));

export {memoizedGoogleAuth as GoogleAuth};
