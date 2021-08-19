import {IDisposer, Instance, getParent, types} from 'mobx-state-tree';
import {applySnapshot, destroy, flow, onSnapshot} from 'mobx-state-tree';
import {ITagJsonApi} from './TagList';
import TagModel from './models/TagModel';
import {environment} from './api';
import update from 'immutability-helper';

const TagAtributes = types
  .model('TagAtributes', {
    name: types.string,
    entry_count: types.number,
    order: types.number,
    date_updated: types.string,
    date_created: types.string,
    date_last_used: types.string,
  })
  .actions(() => ({}));

export const TagJsonAPI = types
  .model('TagJsonAPI', {
    id: types.identifier,
    type: types.string,
    attributes: TagAtributes,
  })
  .actions(self => ({
    update(object: ITagJsonApi) {
      Object.assign(self, object);
    },
    remove() {
      getParent<AppStateStoreModel>(self, 2).removeTag(self.id);
    },
  }));

type AppStateStoreModel = Instance<typeof AppStateStoreModel>;

export const AppStateStoreModel = types
  .model({
    tagsArray: types.array(TagJsonAPI),
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
    currentTag: types.maybeNull(types.string),
    showTagCounts: types.boolean,
  })
  .actions(self => ({
    fetchTags: flow(function* fetchTags(user: string) {
      try {
        let ta: ITagJsonApi[];
        if (self.tagsArray.length > 0) {
          const sortedArray: Array<ITagJsonApi> = TagModel.sort(
            '-date_updated',
            self.tagsArray
          );
          const mostRecentTimestamp = sortedArray[0].attributes.date_updated;
          ta = yield TagModel.fetch([], user, 1, mostRecentTimestamp);
          for (const element of self.tagsArray) {
            const existing = ta.find(o => o.id === element.id);
            if (existing === undefined) {
              ta.push(element);
            }
          }
          applySnapshot(self.tagsArray, ta);
        } else {
          ta = yield TagModel.fetch([], user, 1, null);
          applySnapshot(self.tagsArray, ta);
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    setLoggedInUser(handle: string | null) {
      self.loggedInUser = handle;
    },
    removeTag(id: string) {
      const existing: Instance<typeof TagJsonAPI> = self.tagsArray.filter(
        c => c.id === id
      )[0];
      destroy(existing);
    },
    setSelectedTheme(theme: string) {
      self.selectedTheme = theme;
    },
    setTagSortOrder(order: string) {
      self.tagSortOrder = order;
      const sortedArray: Array<ITagJsonApi> = TagModel.sort(
        self.tagSortOrder,
        self.tagsArray
      );
      applySnapshot(self.tagsArray, sortedArray);
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
    setCurrentTag(value: string | null) {
      self.currentTag = value;
    },
    setShowTagCounts(value: boolean) {
      self.showTagCounts = value;
    },
    moveTagEntry(id: string, atIndex: number) {
      const entry = self.tagsArray.filter(c => c.id === id)[0];
      const entryIndex = self.tagsArray.indexOf(entry);
      const reordered = update(self.tagsArray, {
        $splice: [
          [entryIndex, 1],
          [atIndex, 0, entry],
        ],
      });
      applySnapshot(self.tagsArray, reordered);
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
  showTagCounts: boolean;
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
  showTagCounts: false,
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
