import App from './App';
import {AppContextProvider} from './AppContext';
import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';
import {observer} from 'mobx-react';

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
