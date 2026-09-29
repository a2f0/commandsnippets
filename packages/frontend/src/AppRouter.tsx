import {memo} from 'react';
import {CookiesProvider} from 'react-cookie';
import {BrowserRouter as Router} from 'react-router-dom';

import {App} from './App';

const AppRouter = memo(() => (
  <Router>
    <CookiesProvider defaultSetOptions={{path: '/'}}>
      <App />
    </CookiesProvider>
  </Router>
));

export {AppRouter};
