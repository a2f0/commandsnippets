import App from '../src/App';
import {AppContextProvider} from '../src/AppContext';
import type {MemoryHistory} from 'history';
import React from 'react';
import {Router} from 'react-router-dom';

export interface IProps {
  history: MemoryHistory;
}

const TestAppRouter = ({history}: IProps) => {
  return (
    <Router location={history.location} navigator={history}>
      <AppContextProvider>
        <App />
      </AppContextProvider>
    </Router>
  );
};

export default TestAppRouter;
