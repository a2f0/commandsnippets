import {SocialLogin} from '@capgo/capacitor-social-login';
import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';
import {useAppContext} from './AppContext';
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

      // Check the response type to handle the result correctly
      if (result.result.responseType === 'online') {
        const accessToken = result.result.accessToken?.token;

        if (accessToken) {
          // Use the new integrated OAuth endpoint for Capacitor
          await tearleadsApi.integratedOAuthLogin('google', accessToken);

          const response = await tearleadsApi.getCurrentUser();

          const username = response.data.attributes.username;

          await setupUserSession(username);
        }
      } else {
        // Offline mode - we have a serverAuthCode instead
        // TODO: Implement offline mode handling if needed
      }
    } catch (error) {
      // Log error for debugging but avoid verbose console output
      if (error instanceof Error) {
        console.error('Google Sign-In error:', error.message);
      } else {
        console.error('Google Sign-In error:', error);
      }
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
          Login with Google
        </LoginButton>
      )}
    </>
  );
};

const memoizedGoogleAuthIntegrated = React.memo(observer(GoogleAuthIntegrated));
export {memoizedGoogleAuthIntegrated as GoogleAuthIntegrated};
