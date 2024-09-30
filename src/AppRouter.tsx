import {observer} from 'mobx-react';
import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';

import App from './App';
import {AppContextProvider} from './AppContext';

const AppRouter = React.memo(
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

export default AppRouter;
