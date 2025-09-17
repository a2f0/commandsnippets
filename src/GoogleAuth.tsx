import {SocialLogin} from '@capgo/capacitor-social-login';
import {Google} from '@mui/icons-material';
import {observer} from 'mobx-react';
import React from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';
import {useAppContext} from './AppContext';
import {useOAuth} from './hooks/useOAuth';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {getOAuthRedirectUrl} from './lib/oauth';
import {isCapacitor} from './lib/platform';
import {LoginButton} from './styled/LoginButton';

// Get Google Client ID based on bundle ID
const getGoogleClientID = () => {
  // Check if we're in Capacitor environment
  if (isCapacitor()) {
    // For now, assume dev bundle ID since that's what we're configuring
    // In the future, this could be enhanced to read actual bundle ID from app info
    const bundleId = 'com.tearleads.app.dev'; // default assumption for dev

    switch (bundleId) {
      case 'com.tearleads.app.dev':
        return '424258972420-f97gpnl6e0ri3a87gq583kmf1k606na6.apps.googleusercontent.com';
      default:
        throw new Error(
          `Google OAuth not configured for bundle ID: ${bundleId}`
        );
    }
  }

  // Fallback for web development
  return '424258972420-jcqddba6bu3942ertk3nr7p6lc9e6b6h.apps.googleusercontent.com';
};

const GoogleAuth = () => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [, setCookie] = useCookies(['loggedInUser']);
  const [isOAuthInProgress, setIsOAuthInProgress] = React.useState(false);

  // For non-Capacitor (web), use the existing OAuth flow
  const oauthConfig = {
    provider: 'google' as const,
    clientId: getGoogleClientID(),
    authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    scope: 'https://www.googleapis.com/auth/userinfo.email',
    scopeCheck: (scope: string | null) =>
      scope?.includes('https://www.googleapis.com/auth/userinfo.email') ??
      false,
    redirectUrl: getOAuthRedirectUrl('google'),
  };

  const webOAuth = useOAuth(oauthConfig);

  // For Capacitor, use the Social Login plugin
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
        // For iOS native auth, we have an access token, not an auth code
        // We need to create a new API method or modify the backend to handle this
        const accessToken = result.result.accessToken?.token;
        const idToken = result.result.idToken;

        console.log('Access token:', accessToken ? 'present' : 'missing');
        console.log('ID token:', idToken ? 'present' : 'missing');

        if (accessToken) {
          console.log('Calling tearleadsApi.googleLogin with access token...');

          // Use existing method, passing access token as "code" parameter
          await tearleadsApi.googleLogin(accessToken);
          console.log('tearleadsApi.googleLogin succeeded');

          // Small delay to ensure cookies are set
          await new Promise(resolve => setTimeout(resolve, 100));
          console.log('About to call getCurrentUser...');

          const response = await tearleadsApi.getCurrentUser();
          console.log('getCurrentUser response:', response);

          const username = response.data.attributes.username;
          console.log('Extracted username:', username);

          appConfig.setLoggedInUser(username);
          setCookie('loggedInUser', username, {
            path: '/',
            secure: window.location.protocol === 'https:',
            sameSite: 'strict',
          });
          console.log('Navigating to:', `/${username}`);
          navigate(`/${username}`);
        } else {
          console.log('No access token found!');
        }
      } else {
        // Offline mode - we have a serverAuthCode instead
        console.log(
          'Offline mode response - serverAuthCode:',
          result.result.serverAuthCode
        );
        // Handle offline mode if needed
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
  const initiateLogin = isCapacitor()
    ? handleCapacitorGoogleLogin
    : webOAuth.initiateLogin;
  const finalIsOAuthInProgress = isCapacitor()
    ? isOAuthInProgress
    : webOAuth.isOAuthInProgress;

  return (
    <>
      {!isLoggedIn && !finalIsOAuthInProgress && (
        <LoginButton
          id="googleAuthButton"
          onClick={initiateLogin}
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
