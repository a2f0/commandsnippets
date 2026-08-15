import {type appState, defaultState} from '../../src/lib/shared';
import {createAppStateStore} from '../../src/lib/store/store';

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
