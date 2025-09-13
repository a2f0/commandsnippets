import {useEffect} from 'react';

export const useElectronProtocolHandler = () => {
  useEffect(() => {
    // Only add protocol handler for Electron
    const isElectron =
      typeof window !== 'undefined' &&
      window.electron?.process?.versions?.electron !== undefined;

    if (!isElectron || !window.api?.onProtocolUrl) {
      return;
    }

    const handleProtocolUrl = (url: string) => {
      console.info('Electron protocol URL received:', url);

      try {
        const parsedUrl = new URL(url);

        // Handle OAuth redirects
        if (parsedUrl.pathname.includes('/oauth/')) {
          // Extract the OAuth callback path and parameters
          const pathParts = parsedUrl.pathname.split('/');
          const oauthIndex = pathParts.indexOf('oauth');

          if (oauthIndex !== -1 && pathParts[oauthIndex + 1]) {
            const provider = pathParts[oauthIndex + 1];
            const queryParams = parsedUrl.search;

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
        console.error('Error handling Electron protocol URL:', error);
      }
    };

    // Register the protocol URL handler
    window.api.onProtocolUrl(handleProtocolUrl);

    return () => {
      // Clean up the listener
      if (window.api?.removeProtocolUrlListener) {
        window.api.removeProtocolUrlListener();
      }
    };
  }, []);
};
