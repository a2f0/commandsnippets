import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';

async function init() {
  // Enable MSW in development and test environments using the unified setup
  if (import.meta.env.DEV || import.meta.env.MODE === 'test') {
    try {
      const {enableMocking} = await import('./msw');
      await enableMocking();
      console.log('MSW initialized successfully');

      // Wait for service worker to be controlling the page
      await new Promise<void>(resolve => {
        const checkServiceWorker = () => {
          if (navigator.serviceWorker?.controller) {
            resolve();
          } else {
            setTimeout(checkServiceWorker, 100);
          }
        };
        checkServiceWorker();
      });
    } catch (error) {
      console.error('❌ Failed to start MSW:', error);
    }
  }

  const rootElement = document.getElementById('©');
  if (!rootElement) throw new Error('Failed to find the root element');
  const root = ReactDOM.createRoot(rootElement);
  root.render(<AppRouter />);
}

init();
