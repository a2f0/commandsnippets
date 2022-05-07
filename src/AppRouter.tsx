import App from './App';
import React from 'react';
import {BrowserRouter as Router} from 'react-router-dom';
import {observer} from 'mobx-react';

const AppRouter = React.memo(
  observer(() => {
    return (
      <Router>
        <App />
      </Router>
    );
  })
);

export default AppRouter;
