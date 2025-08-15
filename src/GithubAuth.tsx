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
    console.info(`code (github auth): ${code}`);
    console.info(`is_github_oauth (github auth): ${is_github_oauth}`);
    if (code !== null && code !== '' && is_github_oauth === true) {
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
    window.location.assign(
      `https://github.com/login/oauth/authorize?scope=user:email&client_id=${githubClientID}`
    );
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
