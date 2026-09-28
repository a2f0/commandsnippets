import {GitHub} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';

import {useOAuth} from '../../hooks/useOAuth';
import {environment} from '../../lib/environment';
import {getOAuthRedirectUrl} from '../../lib/oauth';
import {LoginButton} from './LoginButton';

const getGithubClientId = (): string => {
  if (environment === 'staging') {
    return '3be8b14684de28d54a0d';
  }
  if (environment === 'production') {
    return 'a3cf7c1dfabc3df68b06';
  }
  return 'a94dc4b2bb6ed4fc63a0';
};

const githubClientID = getGithubClientId();

const GithubAuth = () => {
  const {initiateLogin, isLoggedIn, isOAuthInProgress} = useOAuth({
    provider: 'github',
    clientId: githubClientID,
    authUrl: 'https://github.com/login/oauth/authorize',
    scope: 'user:email',
    redirectUrl: getOAuthRedirectUrl('github'),
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
