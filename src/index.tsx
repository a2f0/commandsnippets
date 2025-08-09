import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';

async function init() {
  // Enable MSW in development and test environments
  if (
    process.env['NODE_ENV'] === 'development' ||
    process.env['NODE_ENV'] === 'test'
  ) {
    try {
      const {worker} = await import('./mswWorker');

      // Start MSW worker
      await worker.start({
        serviceWorker: {
          url: '/mockServiceWorker.js',
        },
        onUnhandledRequest: 'bypass',
      });

      console.log('MSW worker started successfully');

      // Store worker reference globally for tests
      (window as any).__MSW_WORKER__ = worker;

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

      // Add a health check fetch call to verify MSW interception
      try {
        const response = await fetch('http://localhost:9001/api/v1/health');
        const data = await response.json();
        console.log('✅ MSW health check successful:', data);
      } catch (error) {
        console.error('❌ MSW health check failed:', error);
      }
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
