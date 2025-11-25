import {GitHub} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';

import {useOAuth} from './hooks/useOAuth';
import {environment} from './lib/environment';
import {getOAuthRedirectUrl} from './lib/oauth';
import {isElectron} from './lib/platform';
import {LoginButton} from './styled/LoginButton';

const getGithubClientId = (): string => {
  if (isElectron()) {
    if (environment === 'staging') {
      return 'Ov23liPyvk7aJTCoQc2Z';
    }
    if (environment === 'production') {
      return 'Ov23li7M0TeeigLkM8Zy';
    }
    return 'Ov23limqOPN5fbNYJa6j';
  }

  // Web
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
    clientType: isElectron() ? 'electron' : 'web',
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
