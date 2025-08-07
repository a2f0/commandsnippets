import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';
import {enableMocking} from './msw';

async function init() {
  // Enable MSW in development and test environments
  if (
    process.env['NODE_ENV'] === 'development' ||
    process.env['NODE_ENV'] === 'test'
  ) {
    await enableMocking();
  }

  const rootElement = document.getElementById('©');
  if (!rootElement) throw new Error('Failed to find the root element');
  const root = ReactDOM.createRoot(rootElement);
  root.render(<AppRouter />);

  // Add a health check fetch call to verify MSW interception
  fetch('http://localhost:9001/api/v1/health')
    .then(response => response.json())
    .catch(error => {
      console.error('Health check failed:', error);
    });
}

init();
