import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';

import {useOAuth} from './hooks/useOAuth';
import {environment} from './lib/environment';
import {isCapacitor, isElectron} from './lib/platform';
import {LoginButton} from './styled/LoginButton';

const googleClientID =
  '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';

export const redirectUrl = () => {
  // For Capacitor apps, use deep link scheme based on environment
  if (isCapacitor()) {
    switch (environment) {
      case 'staging':
        return 'com.tearleads.app.staging://oauth/google';
      case 'production':
        return 'com.tearleads.app://oauth/google';
      default:
        return 'com.tearleads.app.dev://oauth/google';
    }
  }

  // For Electron apps, use custom protocol
  if (isElectron()) {
    return 'tearleads://oauth/google';
  }

  // For web apps, use standard URLs
  switch (environment) {
    case 'staging':
      return 'https://app.staging.tearleads.com/oauth/google';
    case 'production':
      return 'https://tearleads.com/oauth/google';
    default:
      return 'http://localhost:8085/oauth/google';
  }
};

const GoogleAuth = () => {
  const {initiateLogin, isLoggedIn, isOAuthInProgress} = useOAuth({
    provider: 'google',
    clientId: googleClientID,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    redirectUrl: redirectUrl(),
    scopeCheck: (scope: string | null) =>
      scope?.includes('https://www.googleapis.com/auth/userinfo.email') ??
      false,
  });

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
