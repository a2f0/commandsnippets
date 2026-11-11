import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';
import {initClickTracking} from './lib/clickTracking';

async function init() {
  if (import.meta.env.MODE === 'test') {
    try {
      const {enableMocking} = await import('./msw/enableMocking');
      await enableMocking();

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

init().catch((error: unknown) => {
  console.error('ERROR: Failed to start application:', error);
});
