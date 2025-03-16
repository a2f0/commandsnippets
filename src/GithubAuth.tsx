import {GitHub} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import apiBase from './lib/api/apiBase';
import LoginButton from './styled/LoginButton';


let githubClientID: string
if (window.location.hostname === 'staging.tearleads.com') {
  githubClientID = '3be8b14684de28d54a0d';
} else if (window.location.hostname === 'tearleads.com') {
  githubClientID = 'a3cf7c1dfabc3df68b06';
} else {
  githubClientID = 'a94dc4b2bb6ed4fc63a0';
}

const GithubAuth = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    const queryString = window.location.search;
    // The callback adds oath/github to the current location.
    const is_github_oauth = window.location.href.includes('oauth/github');
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    console.info(`code (github auth): ${code}`);
    console.info(`is_github_oauth (github auth): ${is_github_oauth}`);
    if (code !== '' && is_github_oauth === true) {
      const newURL = `${window.location.protocol}//${window.location.host}/`;
      window.history.pushState({}, '', newURL);
      const payload = {
        data: {
          type: 'GithubLogin',
          attributes: {
            code: code,
          },
        },
      };
      apiBase
        .post('/github-login/', payload, {withCredentials: true})
        .then(() => {
          apiBase.get('/user/', {withCredentials: true}).then(response => {
            const username = response.data.data.attributes.username;
            appConfig.setLoggedInUser(username);
            document.cookie = `loggedInUser=' ${username}`;
            navigate(`/${username}`);
          });
        })
        .catch(() => {
          appConfig.setLoggedInUser(null);
        });
    }
  }, [appConfig.setLoggedInUser, navigate]);

  const handleGitHubClick = () => {
    window.location.assign(`https://github.com/login/oauth/authorize?scope=user:email&client_id=${githubClientID}`);
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

export default React.memo(observer(GithubAuth));
