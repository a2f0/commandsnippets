import React, {useEffect} from 'react';
import API from './api';
import Button from '@mui/material/Button';
import GitHubIcon from '@mui/icons-material/GitHub';
import LoginButton from './styled/LoginButton';
import {observer} from 'mobx-react';
import {useAppContext} from './AppContext';
import {useNavigate} from 'react-router-dom';

export const githubClientID = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return '3be8b14684de28d54a0d';
  } else if (window.location.hostname === 'tearleads.com') {
    return 'a3cf7c1dfabc3df68b06';
  } else {
    return 'a94dc4b2bb6ed4fc63a0';
  }
};

const GithubAuth = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    const queryString = window.location.search;
    // The callback adds oath/github to the current location.
    const is_github_oauth = window.location.href.includes('oauth/github');
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    console.info('code (github auth): ' + code);
    console.info('is_github_oauth (github auth): ' + is_github_oauth);
    if (code !== '' && is_github_oauth === true) {
      const newURL =
        window.location.protocol + '//' + window.location.host + '/';
      window.history.pushState({}, '', newURL);
      const payload = {
        data: {
          type: 'GithubLogin',
          attributes: {
            code: code,
          },
        },
      };
      API.post('/github-login/', payload, {withCredentials: true})
        .then(() => {
          API.get('/user/', {withCredentials: true}).then(response => {
            const username = response.data.data.attributes.username;
            appConfig.setLoggedInUser(username);
            document.cookie = 'loggedInUser=' + username;
            navigate(`/${username}`);
          });
        })
        .catch(() => {
          appConfig.setLoggedInUser(null);
        })
        .then(() => {});
    }
  }, []);

  const handleGitHubClick = () => {
    window.location.assign(
      'https://github.com/login/oauth/authorize?scope=user:email&client_id=' +
        githubClientID()
    );
  };

  return (
    <>
      {!appConfig.loggedInUser && !window.location.href.includes('oauth/') && (
        <LoginButton
          id="githubAuthButton"
          onClick={handleGitHubClick}
          role="githubAuth"
          startIcon={<GitHubIcon />}
        >
          Login with GitHub
        </LoginButton>
      )}
    </>
  );
};

export default React.memo(observer(GithubAuth));
