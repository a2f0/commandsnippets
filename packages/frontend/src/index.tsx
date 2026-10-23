import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';
import {initClickTracking} from './lib/clickTracking';

async function init() {
  if (import.meta.env.MODE === 'test') {
    try {
      const {enableMocking} = await import('./msw');
      await enableMocking();
      console.log('MSW initialized successfully');

      if ('serviceWorker' in navigator) {
        await navigator.serviceWorker.ready;
      }
    } catch (error) {
      console.error('ERROR: Failed to start MSW:', error);
    }
  }

  const rootElement = document.getElementById('root');
  if (!rootElement) throw new Error('Failed to find the root element');
  const root = ReactDOM.createRoot(rootElement);
  root.render(<AppRouter />);
  initClickTracking();
}

init();
