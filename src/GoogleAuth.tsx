import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';

import {useOAuth} from './hooks/useOAuth';
import {getOAuthRedirectUrl} from './lib/oauth';
import {LoginButton} from './styled/LoginButton';

const googleClientID =
  '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';

const GoogleAuth = () => {
  const {initiateLogin, isLoggedIn, isOAuthInProgress} = useOAuth({
    provider: 'google',
    clientId: googleClientID,
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    redirectUrl: getOAuthRedirectUrl('google'),
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
