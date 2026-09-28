import {useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';
import {v4 as uuidv4} from 'uuid';

import {useAppContext} from '../AppContext';
import {apiClient} from '../lib/api/apiClient';

interface OAuthConfig {
  provider: 'github' | 'google';
  clientId: string;
  authUrl: string;
  scope: string;
  redirectUrl?: string;
  scopeCheck?: (scope: string | null) => boolean;
}

interface OAuthCallbackParams {
  code: string | null;
  scope: string | null;
  state: string | null;
}

export const useOAuth = (config: OAuthConfig) => {
  const appConfig = useAppContext();
  const navigate = useNavigate();
  const [, setCookie] = useCookies(['loggedInUser']);

  const isOAuthCallback = () => {
    const path = window.location.pathname;
    return path.includes(`/oauth/${config.provider}`);
  };

  const handleCallback = async ({code, state}: OAuthCallbackParams) => {
    const storedState = window.sessionStorage.getItem('oauth_state');

    if (!storedState || storedState !== state) {
      console.error('Invalid OAuth state - potential CSRF attack');
      appConfig.setLoggedInUser(null);
      return;
    }

    window.sessionStorage.removeItem('oauth_state');
    const newURL = `${window.location.protocol}//${window.location.host}/`;
    window.history.pushState({}, '', newURL);

    try {
      if (!code) {
        throw new Error('No authorization code received');
      }

      if (config.provider === 'github') {
        await apiClient.githubLogin(code);
      } else {
        await apiClient.googleLogin(code);
      }
      const response = await apiClient.getCurrentUser();
      const username = response.data.attributes.username;

      appConfig.setLoggedInUser(username);
      appConfig.setIsStaff(response.data.attributes.is_staff);
      setCookie('loggedInUser', username, {
        path: '/',
        secure: window.location.protocol === 'https:',
        sameSite: 'strict',
      });
      navigate(`/${username}`);
    } catch (error: unknown) {
      console.error(`${config.provider} authentication error:`, error);
      appConfig.setLoggedInUser(null);
    }
  };

  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const scope = urlParams.get('scope');
    const state = urlParams.get('state');

    // Never log the code: it is a credential until it is exchanged.
    if (scope) {
      console.info(`scope (${config.provider} auth): ${scope}`);
    }

    const isValidCallback =
      code !== null &&
      code !== '' &&
      (config.provider === 'github' ||
        (config.scopeCheck ? config.scopeCheck(scope) : true));

    if (isValidCallback && isOAuthCallback()) {
      handleCallback({code, scope, state});
    }
  }, []);

  const initiateLogin = () => {
    try {
      const state = uuidv4();
      window.sessionStorage.setItem('oauth_state', state);

      const authUrl = new URL(config.authUrl);
      const params = new URLSearchParams({
        client_id: config.clientId,
        state: state,
        scope: config.scope,
      });

      if (config.provider === 'google') {
        params.append('response_type', 'code');
        if (config.redirectUrl) {
          params.append('access_type', 'offline');
          params.append('include_granted_scopes', 'true');
          params.append('redirect_uri', config.redirectUrl);
        }
      } else if (config.provider === 'github') {
        if (config.redirectUrl) {
          params.append('redirect_uri', config.redirectUrl);
        }
      }

      authUrl.search = params.toString();

      window.location.assign(authUrl.toString());
    } catch (error) {
      console.error(
        'Failed to use sessionStorage. OAuth flow cannot proceed.',
        error
      );
    }
  };

  return {
    initiateLogin,
    isLoggedIn: !!appConfig.loggedInUser,
    isOAuthInProgress: window.location.href.includes('oauth/'),
  };
};
