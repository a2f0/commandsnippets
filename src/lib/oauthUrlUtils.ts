/**
 * Handles OAuth callback URL parsing and navigation for deep links and custom protocols
 */
export const handleOAuthCallback = (url: string): void => {
  console.info('OAuth callback URL received:', url);

  if (!url || typeof url !== 'string' || url.trim().length === 0) {
    console.error('Invalid URL provided to handleOAuthCallback:', url);
    return;
  }

  try {
    const parsedUrl = new URL(url);

    // Handle OAuth redirects - check for both pathname and hash-based routing
    const oauthPath = parsedUrl.pathname || parsedUrl.hash?.replace('#', '');
    if (oauthPath?.includes('/oauth/')) {
      // Extract the OAuth callback path and parameters
      const pathParts = oauthPath.split('/').filter(part => part.length > 0);
      const oauthIndex = pathParts.indexOf('oauth');

      if (
        oauthIndex !== -1 &&
        oauthIndex < pathParts.length - 1 &&
        pathParts[oauthIndex + 1]
      ) {
        const provider = pathParts[oauthIndex + 1];

        // Validate provider name to prevent XSS
        if (!provider || !/^[a-zA-Z0-9_-]+$/.test(provider)) {
          console.error('Invalid provider name:', provider);
          return;
        }

        const queryParams = parsedUrl.search || '';

        // Navigate to the OAuth callback route with parameters
        const callbackPath = `/oauth/${provider}${queryParams}`;
        console.info('Navigating to OAuth callback:', callbackPath);

        // Check if window and history are available (browser environment)
        if (typeof window !== 'undefined' && window.history) {
          // Use replace to avoid adding to history stack
          window.history.replaceState({}, '', callbackPath);

          // Trigger a navigation event to ensure React Router picks up the change
          window.dispatchEvent(new PopStateEvent('popstate'));
        } else {
          console.warn('Window or history API not available, cannot navigate');
        }
      } else {
        console.error(
          'Invalid OAuth URL structure - missing provider:',
          oauthPath
        );
      }
    } else {
      console.warn('URL does not contain OAuth path:', url);
    }
  } catch (error) {
    console.error('Error parsing or handling OAuth callback URL:', error);

    // Fallback: try to extract OAuth info from URL string directly
    try {
      const oauthMatch = url.match(/\/oauth\/([a-zA-Z0-9_-]+)/);
      if (oauthMatch?.[1]) {
        const provider = oauthMatch[1];
        const queryStart = url.indexOf('?');
        const queryParams = queryStart !== -1 ? url.substring(queryStart) : '';

        const callbackPath = `/oauth/${provider}${queryParams}`;
        console.info('Fallback navigation to OAuth callback:', callbackPath);

        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState({}, '', callbackPath);
          window.dispatchEvent(new PopStateEvent('popstate'));
        }
      }
    } catch (fallbackError) {
      console.error('Fallback URL parsing also failed:', fallbackError);
    }
  }
};
