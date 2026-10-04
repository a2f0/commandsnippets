import {memo} from 'react';
import {CookiesProvider} from 'react-cookie';
import {App} from './App';
import {Router} from './lib/router/Router';

const AppRouter = memo(() => (
  <Router>
    <CookiesProvider defaultSetOptions={{path: '/'}}>
      <App />
    </CookiesProvider>
  </Router>
));

export {AppRouter};
