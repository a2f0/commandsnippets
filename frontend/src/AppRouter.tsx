import {observer} from 'mobx-react';
import {memo} from 'react';
import {CookiesProvider} from 'react-cookie';
import {BrowserRouter as Router} from 'react-router-dom';

import {App} from './App';
import {AppContextProvider} from './AppContext';

const AppRouter = memo(
  observer(() => {
    return (
      <Router>
        <AppContextProvider>
          <CookiesProvider defaultSetOptions={{path: '/'}}>
            <App />
          </CookiesProvider>
        </AppContextProvider>
      </Router>
    );
  })
);

export {AppRouter};
