import {GitHub} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';

import {useOAuth} from './hooks/useOAuth';
import {environment} from './lib/environment';
import {isCapacitor, isElectron} from './lib/platform';
import {LoginButton} from './styled/LoginButton';

let githubClientID: string;
if (environment === 'staging') {
  githubClientID = '3be8b14684de28d54a0d';
} else if (environment === 'production') {
  githubClientID = 'a3cf7c1dfabc3df68b06';
} else {
  githubClientID = 'a94dc4b2bb6ed4fc63a0';
}

const getGithubRedirectUrl = () => {
  // For Capacitor apps, use deep link scheme based on environment
  if (isCapacitor()) {
    switch (environment) {
      case 'staging':
        return 'com.tearleads.app.staging://oauth/github';
      case 'production':
        return 'com.tearleads.app://oauth/github';
      default:
        return 'com.tearleads.app.dev://oauth/github';
    }
  }

  // For Electron apps, use custom protocol
  if (isElectron()) {
    return 'tearleads://oauth/github';
  }

  // For web apps, use standard URLs
  switch (environment) {
    case 'staging':
      return 'https://app.staging.tearleads.com/oauth/github';
    case 'production':
      return 'https://tearleads.com/oauth/github';
    default:
      return 'http://localhost:8085/oauth/github';
  }
};

const GithubAuth = () => {
  const {initiateLogin, isLoggedIn, isOAuthInProgress} = useOAuth({
    provider: 'github',
    clientId: githubClientID,
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'user:email',
    redirectUrl: getGithubRedirectUrl(),
  });

  return (
    <>
      {!isLoggedIn && !isOAuthInProgress && (
        <LoginButton
          id="githubAuthButton"
          onClick={initiateLogin}
          startIcon={<GitHub />}
        >
          Login with GitHub
        </LoginButton>
      )}
    </>
  );
};

const memoizedGithubAuth = React.memo(observer(GithubAuth));
export {memoizedGithubAuth as GithubAuth};
