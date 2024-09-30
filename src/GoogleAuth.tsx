import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React, {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import apiBase from './lib/api/apiBase';
import LoginButton from './styled/LoginButton';

export const googleClientID = () => {
  if (window.location.hostname === 'staging.tearleads.com') {
    return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
  } else if (window.location.hostname === 'tearleads.com') {
    return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
  } else {
    return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
  }
};

export const redirectUrl = () => {
  console.info(
    'window.location.hostname (redirectUrl): ' + window.location.hostname
  );
  if (window.location.hostname === 'staging.tearleads.com') {
    console.info('returning https%3A//staging.tearleads.com/oauth/google');
    return 'https%3A//staging.tearleads.com/oauth/google';
  } else if (window.location.hostname === 'tearleads.com') {
    console.info('returning https%3A//tearleads.com/oauth/google');
    return 'https%3A//tearleads.com/oauth/google';
  } else {
    console.info('returning http%3A//localhost:8080/oauth/google');
    return 'http%3A//localhost:8080/oauth/google';
  }
};

const GoogleAuth = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    const scope = urlParams.get('scope');
    console.info('code (google auth): ' + code);
    console.info('scope (google auth): ' + scope);
    if (
      code !== '' &&
      scope !== null &&
      scope.includes('https://www.googleapis.com/auth/userinfo.email')
    ) {
      const newURL =
        window.location.protocol + '//' + window.location.host + '/';
      window.history.pushState({}, '', newURL);
      const payload = {
        data: {
          type: 'GoogleLogin',
          attributes: {
            code: code,
          },
        },
      };
      apiBase
        .post('/google-login/', payload, {withCredentials: true})
        .then(() => {
          apiBase.get('/user/', {withCredentials: true}).then(response => {
            const username = response.data.data.attributes.username;
            appConfig.setLoggedInUser(username);
            navigate(`/${username}`);
            document.cookie = 'loggedInUser=' + username;
          });
        })
        .catch(() => {
          appConfig.setLoggedInUser(null);
        });
    }
  }, []);

  const handleGitHubClick = () => {
    const redirect = redirectUrl();
    console.info('window.location.hostname: ' + window.location.hostname);
    console.info('redirect: ' + redirect);
    window.location.assign(
      'https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A//www.googleapis.com/auth/userinfo.email&access_type=offline&include_granted_scopes=true&response_type=code&state=state_parameter_passthrough_value&redirect_uri=' +
        redirect +
        '&client_id=' +
        googleClientID()
    );
  };

  return (
    <>
      {!appConfig.loggedInUser && !window.location.href.includes('oauth/') && (
        <LoginButton
          id="googleAuthButton"
          role="googleAuth"
          onClick={handleGitHubClick}
          startIcon={<Google />}
        >
          Login with Google
        </LoginButton>
      )}
    </>
  );
};

export default React.memo(observer(GoogleAuth));
