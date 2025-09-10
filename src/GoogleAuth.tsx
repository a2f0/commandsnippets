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
  switch (environment) {
    case 'staging':
      return 'https://app.staging.tearleads.com/oauth/google';
    case 'production':
      return 'https://tearleads.com/oauth/google';
    default:
      return 'http://localhost:8085/oauth/google';
  }
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
    const returnedState = urlParams.get('state');
    const storedState = window.sessionStorage.getItem('oauth_state');

    console.info(`code (google auth): ${code}`);
    console.info(`scope (google auth): ${scope}`);

    if (
      code !== null &&
      code !== '' &&
      scope !== null &&
      scope.includes('https://www.googleapis.com/auth/userinfo.email')
    ) {
      if (!storedState || storedState !== returnedState) {
        console.error('Invalid OAuth state - potential CSRF attack');
        appConfig.setLoggedInUser(null);
        return;
      }

      window.sessionStorage.removeItem('oauth_state');
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

    try {
      const state = window.crypto.randomUUID();
      window.sessionStorage.setItem('oauth_state', state);

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      const params = new URLSearchParams({
        scope: 'https://www.googleapis.com/auth/userinfo.email',
        access_type: 'offline',
        include_granted_scopes: 'true',
        response_type: 'code',
        state: state,
        redirect_uri: redirect,
        client_id: googleClientID,
      });

      authUrl.search = params.toString();
      window.location.assign(authUrl.toString());
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
