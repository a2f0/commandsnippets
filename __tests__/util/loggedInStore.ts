import {createAppStateStore} from '../../src/AppStateStore';
import {type appState, defaultState} from '../../src/lib/shared';

// Log the user in for the purpose of testing.
function mergeInLoggedInUser(state: appState) {
  const initialState: appState = {
    ...state,
    loggedInUser: 'test',
  };
  return initialState;
}
let state: appState = defaultState;
state = mergeInLoggedInUser(state);
const store = createAppStateStore(state);
export {store};
