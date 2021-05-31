import {IDisposer, Instance, types} from 'mobx-state-tree';
import {destroy, onSnapshot, applySnapshot} from 'mobx-state-tree';
import {environment} from './api';

export const AppStateStoreModel = types
  .model({
    loggedInUser: types.string,
    selectedTheme: types.string,
    tagSortOrder: types.string,
    entrySortOrder: types.string,
    mainPanel: types.string,
    tagNew: types.boolean,
  })
  .actions(self => ({
    setLoggedInUser(handle: string) {
      self.loggedInUser = handle;
    },
    setSelectedTheme(theme: string) {
      self.selectedTheme = theme;
    },
    setTagSortOrder(order: string) {
      self.tagSortOrder = order;
    },
    setEntrySortOrder(order: string) {
      self.entrySortOrder = order;
    },
    setMainPanel(panelName: string) {
      self.mainPanel = panelName;
    },
    setTagNew(value: boolean) {
      self.tagNew = value;
    },
  }));

interface appState {
  loggedInUser: string;
  selectedTheme: string;
  tagSortOrder: string;
  entrySortOrder: string;
  mainPanel: string;
}

const defaultState = {
  loggedInUser: '',
  selectedTheme: 'darkTheme',
  tagSortOrder: 'order',
  entrySortOrder: 'order',
  mainPanel: 'EntryList',
  tagNew: false,
};

const localStorageKey = 'mst-tearleads-' + environment();
const initialState = localStorage.getItem(localStorageKey);
let state: appState;
if (initialState !== null) {
  state = JSON.parse(initialState);
} else {
  state = defaultState;
}

// const initialState = defaultState;

let snapshotListener: IDisposer;

function createAppStateStore(
  snapshot: appState
): Instance<typeof AppStateStoreModel> {
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

let store: ReturnType<typeof createAppStateStore>;
store = createAppStateStore(state);

export type TStore = ReturnType<typeof createAppStateStore>;
export {store};
