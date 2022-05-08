import {defaultState} from '../src/lib/shared';
const appState = {
  ...defaultState,
  loggedInUser: 'test',
};
localStorage.setItem('mst-tearleads-test', JSON.stringify(appState));
Object.defineProperty(window.document, 'cookie', {
  writable: true,
  value: 'LoggedIn=True',
});
