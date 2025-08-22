import {GitHub} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React, {useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {environment} from './lib/environment';
import {LoginButton} from './styled/LoginButton';

let githubClientID: string;
if (environment === 'staging') {
  githubClientID = '3be8b14684de28d54a0d';
} else if (environment === 'production') {
  githubClientID = 'a3cf7c1dfabc3df68b06';
} else {
  githubClientID = 'a94dc4b2bb6ed4fc63a0';
}

const GithubAuth = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [, setCookie] = useCookies(['loggedInUser']);

  useEffect(() => {
    const queryString = window.location.search;
    // The callback adds oath/github to the current location.
    const is_github_oauth = window.location.href.includes('oauth/github');
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    const returnedState = urlParams.get('state');
    const storedState = window.sessionStorage.getItem('oauth_state');

    console.info(`code (github auth): ${code}`);
    console.info(`is_github_oauth (github auth): ${is_github_oauth}`);

    if (code !== null && code !== '' && is_github_oauth === true) {
      if (!storedState || storedState !== returnedState) {
        console.error('Invalid OAuth state - potential CSRF attack');
        appConfig.setLoggedInUser(null);
        return;
      }

      window.sessionStorage.removeItem('oauth_state');
      const newURL = `${window.location.protocol}//${window.location.host}/`;
      window.history.pushState({}, '', newURL);
      tearleadsApi
        .githubLogin(code)
        .then(() => {
          return tearleadsApi.getCurrentUser();
        })
        .then(response => {
          const username = response.data.attributes.username;
          appConfig.setLoggedInUser(username);
          setCookie('loggedInUser', username, {
            path: '/',
            secure: window.location.protocol === 'https:',
            sameSite: 'strict',
          });
          navigate(`/${username}`);
        })
        .catch((error: unknown) => {
          console.error('GitHub authentication error:', error);
          appConfig.setLoggedInUser(null);
        });
    }
  }, [appConfig.setLoggedInUser, navigate, setCookie]);

  const handleGitHubClick = () => {
    try {
      const state = window.crypto.randomUUID();
      window.sessionStorage.setItem('oauth_state', state);

      window.location.assign(
        `https://github.com/login/oauth/authorize?scope=user:email&client_id=${githubClientID}&state=${state}`
      );
    } catch (error) {
      console.error(
        'Failed to use sessionStorage. OAuth flow cannot proceed.',
        error
      );
      // Show error to user that OAuth cannot proceed
    }
  };

  return (
    <>
      {!appConfig.loggedInUser && !window.location.href.includes('oauth/') && (
        <LoginButton
          id="githubAuthButton"
          onClick={handleGitHubClick}
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
