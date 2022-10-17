import {appState, defaultState} from '../src/lib/shared';
import {createAppStateStore} from '../src/AppStateStore';

// Log the user in for the purpose of testing.
function defaultStateWithSnapshot(snapshot: appState) {
  const initialState: appState = {
    ...snapshot,
    loggedInUser: 'test',
  };
  return initialState;
}
const snapshot: appState = defaultState;
const store = createAppStateStore(snapshot, defaultStateWithSnapshot);
export {store};
