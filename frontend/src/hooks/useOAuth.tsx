import {useEffect} from 'react';
import {useCookies} from 'react-cookie';
import {useNavigate} from 'react-router-dom';
import {v4 as uuidv4} from 'uuid';

import {useAppContext} from '../AppContext';
import {tearleadsApi} from '../lib/api/tearleadsApi';
import {isCapacitor, isElectron} from '../lib/platform';

interface OAuthConfig {
  provider: 'github' | 'google';
  clientId: string;
  authUrl: string;
  scope: string;
  redirectUrl?: string;
  scopeCheck?: (scope: string | null) => boolean;
  clientType: 'electron' | 'web';
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
    // For Capacitor and Electron, OAuth callbacks come through deep links
    if (isCapacitor() || isElectron()) {
      const href = window.location.href;
      return href.includes(`oauth/${config.provider}`);
    }

    // For web, check the pathname as before
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
        await tearleadsApi.githubLogin(code, config.clientType);
      } else {
        await tearleadsApi.googleLogin(code);
      }
      const response = await tearleadsApi.getCurrentUser();
      const username = response.data.attributes.username;

      appConfig.setLoggedInUser(username);
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
    let queryString: string;
    let code: string | null = null;
    let scope: string | null = null;
    let state: string | null = null;

    // Handle deep link URLs for Capacitor and Electron
    if (isCapacitor() || isElectron()) {
      const href = window.location.href;
      console.info(`Full URL (${config.provider} auth):`, href);

      // Extract query parameters from deep link URL
      const url = new URL(href);
      code = url.searchParams.get('code');
      scope = url.searchParams.get('scope');
      state = url.searchParams.get('state');
    } else {
      // Web app - use standard query string parsing
      queryString = window.location.search;
      const urlParams = new URLSearchParams(queryString);
      code = urlParams.get('code');
      scope = urlParams.get('scope');
      state = urlParams.get('state');
    }

    console.info(`code (${config.provider} auth): ${code}`);
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
      const authUrlString = authUrl.toString();

      // For Electron, open OAuth URL in system browser
      if (isElectron() && window.api?.openExternal) {
        window.api.openExternal(authUrlString);
      } else {
        // For web and Capacitor, navigate in the current window
        window.location.assign(authUrlString);
      }
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
