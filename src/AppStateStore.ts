import {IDisposer, Instance, types} from 'mobx-state-tree';
import {
  ITagTextEntryThroughModelJsonApi,
  TagTextEntryThroughModel,
} from './models/TagTextEntryThroughModel';
import {
  ITextEntryJsonApi,
  TextEntryHelpers,
  TextEntryModel,
} from './models/TextEntryModel';
import {TagHelpers, TagModel} from './models/TagModel';
import {applySnapshot, destroy, flow, onSnapshot} from 'mobx-state-tree';
import {ITagJsonApi} from './models/TagModel';
import {UserModel} from './models/UserModel';
import {environment} from './api';

export type RootModel = Instance<typeof AppStateStoreModel>;

export const AppStateStoreModel = types
  .model({
    tagsArray: types.array(TagModel),
    textEntriesArray: types.array(TextEntryModel),
    untaggedTextEntriesArray: types.array(TextEntryModel),
    tagTextEntryThroughModel: types.array(TagTextEntryThroughModel),
    usersArray: types.array(UserModel),
    loggedInUser: types.maybeNull(types.string),
    selectedTheme: types.string,
    tagSortOrder: types.string,
    entryNew: types.maybeNull(types.string),
    entrySortOrder: types.string,
    untaggedEntrySortOrder: types.string,
    mainPanel: types.string,
    tagNew: types.maybeNull(types.string),
    tagSearch: types.boolean,
    mostRecentCopyType: types.maybeNull(types.string),
    mostRecentCopyID: types.maybeNull(types.string),
    currentTag: types.maybeNull(types.string),
    currentUser: types.maybeNull(types.string),
    showTagCounts: types.boolean,
  })
  .actions(self => ({
    fetchTags: flow(function* fetchTags(user: string) {
      try {
        const mostRecentTimestamp: string | null =
          TagHelpers.getMostRecentTimeStamp(self.tagsArray);
        const ta = yield TagHelpers.fetch([], user, 1, mostRecentTimestamp);
        for (const element of ta) {
          if (element.type === 'Tag') {
            const existing = self.tagsArray.find(o => o.id === element.id);
            if (existing === undefined) {
              self.tagsArray.push(element);
            } else {
              const existingTimestamp = new Date(
                existing.attributes.date_updated
              );
              const incomingTimeStamp = new Date(
                element.attributes.date_updated
              );
              if (incomingTimeStamp > existingTimestamp) {
                existing.update(element);
              }
            }
          } else if (element.type === 'User') {
            const existing = self.usersArray.find(o => o.id === element.id);
            if (existing === undefined) {
              self.usersArray.push(element);
            }
          }
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    fetchTextEntries: flow(function* fetchTextEntries(
      user: string,
      tag: string
    ) {
      try {
        const mostRecentTimestamp: string | null =
          TextEntryHelpers.getMostRecentTimeStamp(self.textEntriesArray);
        const ta = yield TextEntryHelpers.fetch(
          [],
          user,
          tag,
          1,
          mostRecentTimestamp,
          null
        );
        for (let i = 0; i < ta.length; i++) {
          if (ta[i].type === 'TextEntry') {
            const existing = self.textEntriesArray.find(o => o.id === ta[i].id);
            if (existing === undefined) {
              self.textEntriesArray.push(ta[i]);
            }
          } else if (ta[i].type === 'Tag') {
            const existing = self.tagsArray.find(o => o.id === ta[i].id);
            if (existing === undefined) {
              self.tagsArray.push(ta[i]);
            }
          } else if (ta[i].type === 'TagTextEntryThroughModel') {
            const existing = self.tagTextEntryThroughModel.find(
              o => o.id === ta[i].id
            );
            if (existing === undefined) {
              self.tagTextEntryThroughModel.push(ta[i]);
            } else {
              const existingTimestamp = new Date(
                existing.attributes.date_updated
              );
              const incomingTimeStamp = new Date(ta[i].attributes.date_updated);
              if (incomingTimeStamp > existingTimestamp) {
                existing.update(ta[i]);
              }
            }
          } else if (ta[i].type === 'User') {
            const existing = self.usersArray.find(o => o.id === ta[i].id);
            if (existing === undefined) {
              self.usersArray.push(ta[i]);
            }
          } else {
            throw 'Unknown object type: ' + ta[i].type;
          }
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    fetchUntaggedTextEntries: flow(function* fetchUntaggedTextEntries(
      user: string
    ) {
      try {
        const existingUser = self.usersArray.find(
          o => o.attributes.username === user
        );
        let filteredTextEntries;
        if (existingUser !== undefined) {
          filteredTextEntries = self.textEntriesArray.filter(element => {
            element.relationships.user.data.id === existingUser.id;
          });
        } else {
          filteredTextEntries = self.textEntriesArray;
        }
        const mostRecentTimestamp: string | null =
          TextEntryHelpers.getMostRecentTimeStamp(filteredTextEntries);
        const ta = yield TextEntryHelpers.fetch(
          [],
          user,
          null,
          1,
          mostRecentTimestamp,
          0
        );
        for (let i = 0; i < ta.length; i++) {
          if (ta[i].type === 'TextEntry') {
            const existing = self.untaggedTextEntriesArray.find(
              o => o.id === ta[i].id
            );
            if (existing === undefined) {
              self.untaggedTextEntriesArray.push(ta[i]);
            }
          } else if (ta[i].type === 'User') {
            const existing = self.usersArray.find(o => o.id === ta[i].id);
            if (existing === undefined) {
              self.usersArray.push(ta[i]);
            }
          } else {
            throw 'Unknown object type: ' + ta[i].type;
          }
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    setLoggedInUser(handle: string | null) {
      self.loggedInUser = handle;
    },
    updateOrCreateTag(object: ITagJsonApi) {
      const existing = self.tagsArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.tagsArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    updateOrCreateTextEntry(object: ITextEntryJsonApi) {
      const existing = self.textEntriesArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.textEntriesArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    updateOrCreateTagTextEntryThroughModel(
      object: ITagTextEntryThroughModelJsonApi
    ) {
      const existing = self.tagTextEntryThroughModel.find(
        o => o.id === object.id
      );
      if (existing === undefined) {
        self.tagTextEntryThroughModel.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
    removeTag(id: string) {
      const existing: Instance<typeof TagModel> = self.tagsArray.filter(
        c => c.id === id
      )[0];
      destroy(existing);
    },
    removeTagTextEntryThroughModel(id: string) {
      const existing: Instance<typeof TagTextEntryThroughModel> =
        self.tagTextEntryThroughModel.filter(c => c.id === id)[0];
      destroy(existing);
    },
    removeUntaggedTextEntry(id: string) {
      const existing: Instance<typeof TextEntryModel> =
        self.untaggedTextEntriesArray.filter(c => c.id === id)[0];
      destroy(existing);
    },
    removeTextEntry(id: string) {
      console.info('id: ' + id);
    },
    setSelectedTheme(theme: string) {
      self.selectedTheme = theme;
    },
    setTagSortOrder(order: string) {
      self.tagSortOrder = order;
    },
    setEntryNew(value: string | null) {
      self.entryNew = value;
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
    setTagNew(value: string | null) {
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
    setCurrentUser(value: string | null) {
      self.currentUser = value;
    },
    setShowTagCounts(value: boolean) {
      self.showTagCounts = value;
    },
  }));

export interface appState {
  loggedInUser: string | null;
  selectedTheme: string;
  tagSortOrder: string;
  entryNew: string | null;
  entrySortOrder: string;
  untaggedEntrySortOrder: string;
  mainPanel: string;
  tagNew: string | null;
  tagSearch: boolean;
  mostRecentCopyType: string | null;
  mostRecentCopyID: string | null;
  showTagCounts: boolean;
}

const defaultState: appState = {
  loggedInUser: null,
  selectedTheme: 'darkTheme',
  tagSortOrder: 'order',
  entryNew: null,
  entrySortOrder: 'order',
  untaggedEntrySortOrder: 'date_updated',
  mainPanel: 'EntryList',
  tagNew: null,
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
