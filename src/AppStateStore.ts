import {IDisposer, Instance, types} from 'mobx-state-tree';
import {applySnapshot, destroy, onSnapshot} from 'mobx-state-tree';
import {environment} from './api';

export const AppStateStoreModel = types
  .model({
    loggedInUser: types.maybeNull(types.string),
    selectedTheme: types.string,
    tagSortOrder: types.string,
    entrySortOrder: types.string,
    untaggedEntrySortOrder: types.string,
    mainPanel: types.string,
    tagNew: types.boolean,
    tagSearch: types.boolean,
    mostRecentCopyType: types.maybeNull(types.string),
    mostRecentCopyID: types.maybeNull(types.string),
  })
  .actions(self => ({
    setLoggedInUser(handle: string | null) {
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
    setUntaggedEntrySortOrder(order: string) {
      self.untaggedEntrySortOrder = order;
    },
    setMainPanel(panelName: string) {
      self.mainPanel = panelName;
    },
    setTagNew(value: boolean) {
      self.tagNew = value;
    },
    setTagSearch(value: boolean) {
      self.tagSearch = value;
    },
    setMostRecentCopyType(value: string) {
      self.mostRecentCopyType = value;
    },
    setMostRecentCopyID(value: string) {
      self.mostRecentCopyID = value;
    },
  }));

export interface appState {
  loggedInUser: string | null;
  selectedTheme: string;
  tagSortOrder: string;
  entrySortOrder: string;
  untaggedEntrySortOrder: string;
  mainPanel: string;
  tagNew: boolean;
  tagSearch: boolean;
  mostRecentCopyType: string | null;
  mostRecentCopyID: string | null;
}

const defaultState: appState = {
  loggedInUser: null,
  selectedTheme: 'darkTheme',
  tagSortOrder: 'order',
  entrySortOrder: 'order',
  untaggedEntrySortOrder: 'date_updated',
  mainPanel: 'EntryList',
  tagNew: false,
  tagSearch: false,
  mostRecentCopyType: null,
  mostRecentCopyID: null,
};

export const defaultStateStringified: string = JSON.stringify(defaultState);

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
