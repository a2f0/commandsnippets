import type {MemoryHistory} from 'history';
import {Router} from 'react-router-dom';

import {App} from '../../src/App';
import {LoggedInAppContextProvider} from './LoggedInAppContextProvider';
import {CookiesProvider} from 'react-cookie';

export interface IProps {
  history: MemoryHistory;
}

const TestAppRouter = ({history}: IProps) => {
  return (
    <Router location={history.location} navigator={history}>
      <LoggedInAppContextProvider>
        <CookiesProvider defaultSetOptions={{path: '/'}}>
          <App />
        </CookiesProvider>
      </LoggedInAppContextProvider>
    </Router>
  );
};

export {TestAppRouter};
