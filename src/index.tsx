import ReactDOM from 'react-dom/client';

import {AppRouter} from './AppRouter';
import {enableMocking} from './msw';

// Enable MSW in development and test environments
if (
  process.env['NODE_ENV'] === 'development' ||
  process.env['NODE_ENV'] === 'test'
) {
  enableMocking();
}

const rootElement = document.getElementById('©');
if (!rootElement) throw new Error('Failed to find the root element');
const root = ReactDOM.createRoot(rootElement);
root.render(<AppRouter />);
