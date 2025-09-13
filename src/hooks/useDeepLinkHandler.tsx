import {App} from '@capacitor/app';
import {Capacitor} from '@capacitor/core';
import {useEffect} from 'react';
import {useNavigate} from 'react-router-dom';

export const useDeepLinkHandler = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Only add deep link listener for native platforms
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    const handleAppUrlOpen = (event: {url: string}) => {
      console.info('Deep link received:', event.url);

      try {
        const url = new URL(event.url);

        // Handle OAuth redirects
        if (url.pathname.includes('/oauth/')) {
          // Extract the OAuth callback path and parameters
          const pathParts = url.pathname.split('/');
          const oauthIndex = pathParts.indexOf('oauth');

          if (oauthIndex !== -1 && pathParts[oauthIndex + 1]) {
            const provider = pathParts[oauthIndex + 1];
            const queryParams = url.search;

            // Navigate to the OAuth callback route with parameters
            const callbackPath = `/oauth/${provider}${queryParams}`;
            console.info('Navigating to OAuth callback:', callbackPath);

            // Use replace to avoid adding to history stack
            window.history.replaceState({}, '', callbackPath);

            // Trigger a navigation event to ensure React Router picks up the change
            window.dispatchEvent(new PopStateEvent('popstate'));
          }
        }
      } catch (error) {
        console.error('Error handling deep link:', error);
      }
    };

    // Listen for app URL opens (deep links)
    App.addListener('appUrlOpen', handleAppUrlOpen);

    return () => {
      App.removeAllListeners();
    };
  }, [navigate]);
};
