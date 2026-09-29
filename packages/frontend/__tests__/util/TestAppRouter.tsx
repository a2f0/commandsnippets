import type {MemoryHistory} from 'history';
import {useSyncExternalStore} from 'react';
import {CookiesProvider} from 'react-cookie';
import {Router} from 'react-router-dom';
import {App} from '../../src/App';

export interface IProps {
  history: MemoryHistory;
}

/**
 * The app in a memory router that follows `history` (a navigation renders
 * the new location). Sign in first (`signIn`) for a signed-in app.
 */
const TestAppRouter = ({history}: IProps) => {
  const location = useSyncExternalStore(
    listener => history.listen(listener),
    () => history.location
  );
  return (
    <Router location={location} navigator={history}>
      <CookiesProvider defaultSetOptions={{path: '/'}}>
        <App />
      </CookiesProvider>
    </Router>
  );
};

export {TestAppRouter};
