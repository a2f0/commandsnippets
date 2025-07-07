import {observer} from 'mobx-react';
import {memo} from 'react';
import {BrowserRouter as Router} from 'react-router-dom';

import {App} from './App';
import {AppContextProvider} from './AppContext';

const AppRouter = memo(
  observer(() => {
    return (
      <Router>
        <AppContextProvider>
          <App />
        </AppContextProvider>
      </Router>
    );
  })
);

export {AppRouter};
