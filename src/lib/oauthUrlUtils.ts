/**
 * Handles OAuth callback URL parsing and navigation for deep links and custom protocols
 */
export const handleOAuthCallback = (url: string): void => {
  console.info('OAuth callback URL received:', url);

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
    console.error('Error handling OAuth callback URL:', error);
  }
};
