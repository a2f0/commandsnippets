import {IDisposer, Instance, getParent, types} from 'mobx-state-tree';
import {applySnapshot, destroy, flow, onSnapshot} from 'mobx-state-tree';
import API from './api';
import {ITagJsonApi} from './TagList';
import {environment} from './api';
import {sortArrayByAttribute} from './lib/tags';
import update from 'immutability-helper';

interface ITagJsonApiResponse {
  data: ITagJsonApi[];
  links: {
    next: string;
  };
}

const TagAtributes = types
  .model('TagAtributes', {
    name: types.string,
    entry_count: types.number,
    order: types.number,
    date_updated: types.string,
    date_created: types.string,
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

function fetchAllTags(tags: ITagJsonApi[], user: string, page: number) {
  const f: Promise<ITagJsonApi[]> = API.get<ITagJsonApiResponse>('/tags', {
    params: {
      'page[number]': page,
      'filter[user.username]': user,
      sort: 'date_updated',
    },
  }).then(response => {
    tags = tags.concat(response.data.data);
    if (response.data.links.next === null) {
      return tags;
    }
    return fetchAllTags(tags, user, ++page);
  });
  return f;
}

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
        const ta: ITagJsonApi[] = yield fetchAllTags([], user, 1);
        for (const element of self.tagsArray) {
          const existing = ta.find(o => o.id === element.id);
          if (existing === undefined) {
            ta.push(element);
          }
        }

        const sortedArray: ITagJsonApi[] = sortArrayByAttribute(
          self.tagSortOrder,
          ta
        );

        applySnapshot(self.tagsArray, sortedArray);
      } catch (error) {
        console.error('An error occurred.');
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
      const sortedArray: Array<ITagJsonApi> = sortArrayByAttribute(
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
