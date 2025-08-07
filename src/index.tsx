import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';

async function init() {
  // Enable MSW in development and test environments
  if (
    process.env['NODE_ENV'] === 'development' ||
    process.env['NODE_ENV'] === 'test'
  ) {
    const {worker} = await import('./mswWorker');
    await worker.start({
      serviceWorker: {
        url: '/mockServiceWorker.js',
      },
      onUnhandledRequest: 'bypass',
    });

    console.log('MSW worker started successfully');

    // Wait a moment for service worker to be fully ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Add a health check fetch call to verify MSW interception
    try {
      const response = await fetch('http://localhost:9001/api/v1/health');
      const data = await response.json();
      console.log('Health check response:', data);
    } catch (error) {
      console.error('Health check failed:', error);
    }
  }

  const rootElement = document.getElementById('©');
  if (!rootElement) throw new Error('Failed to find the root element');
  const root = ReactDOM.createRoot(rootElement);
  root.render(<AppRouter />);
}

init();
