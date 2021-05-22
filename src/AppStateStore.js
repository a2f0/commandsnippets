import {types} from 'mobx-state-tree';
import {destroy, onSnapshot, applySnapshot} from 'mobx-state-tree';
import {environment} from './api.ts';

const AppStateStoreModel = types
  .model({
    loggedInUser: types.string,
    selectedTheme: types.string,
    tagSortOrder: types.string,
  })
  .actions(self => ({
    setLoggedInUser(handle) {
      self.loggedInUser = handle;
    },
    setSelectedTheme(theme) {
      self.selectedTheme = theme;
    },
    setTagSortOrder(order) {
      self.tagSortOrder = order;
    },
  }));

const defaultState = {
  loggedInUser: '',
  selectedTheme: 'darkTheme',
  tagSortOrder: 'order',
};

const localStorageKey = 'mst-tearleads-' + environment();

const initialState = localStorage.getItem(localStorageKey)
  ? JSON.parse(localStorage.getItem(localStorageKey))
  : defaultState;

let snapshotListener;

function createAppStateStore(snapshot) {
  // clean up snapshot listener
  if (snapshotListener) snapshotListener();
  // kill old store to prevent accidental use and run clean up hooks
  if (store) destroy(store);

  // create new one
  store = AppStateStoreModel.create(defaultState);
  const snapshotMergedIntoDefaults = {
    ...defaultState,
    ...snapshot,
  };
  applySnapshot(store, snapshotMergedIntoDefaults);

  // connect local storage
  snapshotListener = onSnapshot(store, snapshot =>
    localStorage.setItem(localStorageKey, JSON.stringify(snapshot))
  );

  return store;
}

let store = createAppStateStore(initialState);

export default store;
