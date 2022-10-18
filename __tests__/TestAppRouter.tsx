import App from '../src/App';
import LoggedInAppContextProvider from './LoggedInAppContextProvider';
import type {MemoryHistory} from 'history';
import React from 'react';
import {Router} from 'react-router-dom';

export interface IProps {
  history: MemoryHistory;
}

const TestAppRouter = ({history}: IProps) => {
  return (
    <Router location={history.location} navigator={history}>
      <LoggedInAppContextProvider>
        <App />
      </LoggedInAppContextProvider>
    </Router>
  );
};

export default TestAppRouter;
