import {SocialLogin} from '@capgo/capacitor-social-login';
import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';
import {useAppContext} from './AppContext';
import {baseURL} from './lib/api/baseUrl';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {LoginButton} from './styled/LoginButton';

const GoogleAuthIntegrated = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [, setCookie] = useCookies(['loggedInUser']);
  const [isOAuthInProgress, setIsOAuthInProgress] = React.useState(false);

  // Helper function to setup user session after successful authentication
  const setupUserSession = async (username: string) => {
    appConfig.setLoggedInUser(username);
    setCookie('loggedInUser', username, {
      path: '/',
      secure: window.location.protocol === 'https:',
      sameSite: 'strict',
    });
    console.log('Navigating to:', `/${username}`);
    navigate(`/${username}`);
  };

  // Handle Capacitor Google login
  const handleCapacitorGoogleLogin = async () => {
    try {
      setIsOAuthInProgress(true);

      // Initialize and login with Google
      const result = await SocialLogin.login({
        provider: 'google',
        options: {
          scopes: ['email', 'profile'],
        },
      });

      console.log('Full SocialLogin result:', JSON.stringify(result, null, 2));

      // Check the response type to handle the result correctly
      if (result.result.responseType === 'online') {
        const accessToken = result.result.accessToken?.token;
        const idToken = result.result.idToken;

        console.log('Access token:', accessToken ? 'present' : 'missing');
        console.log('ID token:', idToken ? 'present' : 'missing');

        if (accessToken) {
          console.log(
            'Integrated OAuth - calling tearleadsApi.integratedOAuthLogin...'
          );
          console.log(
            'integratedOAuthLogin - URL:',
            `${baseURL}/integrated-oauth/`
          );

          // Use the new integrated OAuth endpoint for Capacitor
          await tearleadsApi.integratedOAuthLogin('google', accessToken);
          console.log('tearleadsApi.integratedOAuthLogin succeeded');

          // Check cookies after login
          console.log('Document cookies after login:', document.cookie);

          // Small delay to ensure cookies are set
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log('About to call getCurrentUser...');

          const response = await tearleadsApi.getCurrentUser();
          console.log('getCurrentUser response:', response);

          const username = response.data.attributes.username;
          console.log('Extracted username:', username);

          await setupUserSession(username);
        } else {
          console.log('No access token found!');
        }
      } else {
        // Offline mode - we have a serverAuthCode instead
        console.log(
          'Offline mode response - serverAuthCode:',
          result.result.serverAuthCode
        );
        // TODO: Implement offline mode handling if needed
        console.log('Offline mode not yet implemented');
      }
    } catch (error) {
      console.error('Google Sign-In error - full error object:', error);
      if (error instanceof Error) {
        console.error('Google Sign-In error - error message:', error.message);
        console.error('Google Sign-In error - error stack:', error.stack);
      }
      console.error('Google Sign-In error - typeof error:', typeof error);
      console.error(
        'Google Sign-In error - JSON stringify:',
        JSON.stringify(error, null, 2)
      );
      appConfig.setLoggedInUser(null);
    } finally {
      setIsOAuthInProgress(false);
    }
  };

  const isLoggedIn = appConfig.loggedInUser !== null;

  return (
    <>
      {!isLoggedIn && !isOAuthInProgress && (
        <LoginButton
          id="googleAuthButton"
          onClick={handleCapacitorGoogleLogin}
          startIcon={<Google />}
        >
          Login with Zoogle1
        </LoginButton>
      )}
    </>
  );
};

const memoizedGoogleAuthIntegrated = React.memo(observer(GoogleAuthIntegrated));
export {memoizedGoogleAuthIntegrated as GoogleAuthIntegrated};
