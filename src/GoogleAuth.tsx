import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React, {useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {environment} from './lib/environment';
import {LoginButton} from './styled/LoginButton';

const googleClientID =
  '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';

export const redirectUrl = () => {
  console.info(`environment (redirectUrl): ${environment}`);
  if (environment === 'staging') {
    console.info('returning https%3A//app.staging.tearleads.com/oauth/google');
    return 'https%3A//app.staging.tearleads.com/oauth/google';
  }
  if (environment === 'production') {
    console.info('returning https%3A//tearleads.com/oauth/google');
    return 'https%3A//tearleads.com/oauth/google';
  }
  console.info('returning http%3A//localhost:8080/oauth/google');
  return 'http%3A//localhost:8080/oauth/google';
};

const GoogleAuth = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [, setCookie] = useCookies(['loggedInUser']);

  useEffect(() => {
    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const code = urlParams.get('code');
    const scope = urlParams.get('scope');
    console.info(`code (google auth): ${code}`);
    console.info(`scope (google auth): ${scope}`);
    if (
      code !== null &&
      code !== '' &&
      scope !== null &&
      scope.includes('https://www.googleapis.com/auth/userinfo.email')
    ) {
      const newURL = `${window.location.protocol}//${window.location.host}/`;
      window.history.pushState({}, '', newURL);
      tearleadsApi
        .googleLogin(code)
        .then(() => {
          return tearleadsApi.getCurrentUser();
        })
        .then(response => {
          const username = response.data.attributes.username;
          appConfig.setLoggedInUser(username);
          navigate(`/${username}`);
          setCookie('loggedInUser', username, {
            path: '/',
            secure: window.location.protocol === 'https:',
            sameSite: 'strict',
          });
        })
        .catch((error: unknown) => {
          console.error('Google authentication error:', error);
          appConfig.setLoggedInUser(null);
        });
    }
  }, [appConfig.setLoggedInUser, navigate, setCookie]);

  const handleGitHubClick = () => {
    const redirect = redirectUrl();
    console.info(`environment: ${environment}`);
    console.info(`redirect: ${redirect}`);
    window.location.assign(
      `https://accounts.google.com/o/oauth2/v2/auth?scope=https%3A//www.googleapis.com/auth/userinfo.email&access_type=offline&include_granted_scopes=true&response_type=code&state=state_parameter_passthrough_value&redirect_uri=${redirect}&client_id=${googleClientID}`
    );
  };

  return (
    <>
      {!appConfig.loggedInUser && !window.location.href.includes('oauth/') && (
        <LoginButton
          id="googleAuthButton"
          onClick={handleGitHubClick}
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
