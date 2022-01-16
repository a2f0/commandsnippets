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
import {IUserJsonApi, UserModel} from './models/UserModel';
import {TagHelpers, TagModel} from './models/TagModel';
import {
  activeEntryEditField,
  activeSearch,
  appMode,
  appState,
  defaultState,
  entrySearchMethod,
} from './lib/shared';
import {applySnapshot, destroy, flow, onSnapshot} from 'mobx-state-tree';
import {ITagJsonApi} from './models/TagModel';
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
    tagTextEntryThroughModelSortOrder: types.string,
    entrySortOrder: types.string,
    tagNew: types.maybeNull(types.string),
    tagSearch: types.boolean,
    mostRecentCopyType: types.maybeNull(types.string),
    mostRecentCopyID: types.maybeNull(types.string),
    currentTag: types.maybeNull(types.string),
    currentUser: types.maybeNull(types.string),
    showTagCounts: types.boolean,
  })
  .volatile<{
    activeSearch: activeSearch;
    activeEntryEditField: activeEntryEditField;
    clickCount: number;
    entrySelectedID: string;
    entrySearchString: string;
    entrySearchMethod: entrySearchMethod;
    tagSearchString: string;
    tagSelectedID: string;
    appMode: appMode;
  }>(() => ({
    activeSearch: activeSearch.tags,
    activeEntryEditField: activeEntryEditField.subject,
    clickCount: 0,
    entrySelectedID: '',
    entrySearchString: '',
    entrySearchMethod: entrySearchMethod.currentTagOnly,
    tagSearchString: '',
    tagSelectedID: '',
    appMode: appMode.tagsList,
  }))
  .actions(self => ({
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
    updateOrCreateUntaggedTextEntry(object: ITextEntryJsonApi) {
      const existing = self.untaggedTextEntriesArray.find(
        o => o.id === object.id
      );
      if (existing === undefined) {
        self.untaggedTextEntriesArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
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
    updateOrCreateUser(object: IUserJsonApi) {
      const existing = self.usersArray.find(o => o.id === object.id);
      if (existing === undefined) {
        self.usersArray.push(object);
      } else {
        const existingTimestamp = new Date(existing.attributes.date_updated);
        const incomingTimeStamp = new Date(object.attributes.date_updated);
        if (incomingTimeStamp > existingTimestamp) {
          existing.update(object);
        }
      }
    },
  }))
  .actions(self => ({
    fetchTags: flow(function* fetchTags(user: string) {
      try {
        const existingUser = self.usersArray.find(
          o => o.attributes.username === user
        );
        let filteredTags: Array<ITagJsonApi> = [];
        if (existingUser !== undefined) {
          filteredTags = self.tagsArray.filter(element => {
            return element.relationships.user.data.id === existingUser.id;
          });
        }
        const mostRecentTimestamp: string | null =
          TagHelpers.getMostRecentTimeStamp(filteredTags);
        const collection = yield TagHelpers.fetch(
          [],
          user,
          1,
          mostRecentTimestamp
        );
        for (const element of collection) {
          if (element.type === 'Tag') {
            self.updateOrCreateTag(element);
          } else if (element.type === 'User') {
            self.updateOrCreateUser(element);
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
        const userObject = store.usersArray.find(
          element => element.attributes.username === user
        );

        const textEntriesFiltered: ITextEntryJsonApi[] = [];

        const tagObject = store.tagsArray.find(
          element =>
            element.attributes.name === tag &&
            element.relationships.user.data.id === userObject?.id
        );

        const tagTextEntryThroughModelFiltered =
          store.tagTextEntryThroughModel.filter(
            element => element.relationships.tag.data.id === tagObject?.id
          );

        tagTextEntryThroughModelFiltered.map(element => {
          const entry = self.textEntriesArray.find(textEntry => {
            return textEntry.id === element.relationships.text_entry.data.id;
          });
          if (entry !== undefined) {
            textEntriesFiltered.push(entry);
          }
        });

        const mostRecentTimestamp: string | null =
          TextEntryHelpers.getMostRecentTimeStamp(textEntriesFiltered);
        const collection = yield TextEntryHelpers.fetch(
          [],
          user,
          tag,
          1,
          mostRecentTimestamp,
          null
        );
        for (const element of collection) {
          if (element.type === 'Tag') {
            self.updateOrCreateTag(element);
          } else if (element.type === 'User') {
            self.updateOrCreateUser(element);
          } else if (element.type === 'TextEntry') {
            self.updateOrCreateTextEntry(element);
          } else if (element.type === 'TagTextEntryThroughModel') {
            self.updateOrCreateTagTextEntryThroughModel(element);
          } else {
            throw `Unknown object type: ${element}`;
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
        let filteredTextEntries: Array<ITextEntryJsonApi> = [];
        if (existingUser !== undefined) {
          filteredTextEntries = self.untaggedTextEntriesArray.filter(
            element => {
              return element.relationships.user.data.id === existingUser.id;
            }
          );
        }
        const mostRecentTimestamp: string | null =
          TextEntryHelpers.getMostRecentTimeStamp(filteredTextEntries);
        const collection = yield TextEntryHelpers.fetch(
          [],
          user,
          null,
          1,
          mostRecentTimestamp,
          0
        );
        for (const element of collection) {
          if (element.type === 'TextEntry') {
            self.updateOrCreateUntaggedTextEntry(element);
          } else if (element.type === 'User') {
            self.updateOrCreateUser(element);
          } else {
            throw `Unknown object type: ${element}`;
          }
        }
      } catch (error) {
        console.error(error);
        throw error;
      }
    }),
    incrementClickCount() {
      self.clickCount += 1;
    },
    setLoggedInUser(handle: string | null) {
      self.loggedInUser = handle;
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
    setActiveSearch(activeSearch: activeSearch) {
      self.activeSearch = activeSearch;
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
    setEntrySelectedID(value: string) {
      self.entrySelectedID = value;
    },
    setEntrySearchMethod(method: entrySearchMethod) {
      self.entrySearchMethod = method;
    },
    setTagTextEntryThroughModelSortOrder(order: string) {
      self.tagTextEntryThroughModelSortOrder = order;
    },
    setEntrySortOrder(order: string) {
      self.entrySortOrder = order;
    },
    setTagNew(value: string | null) {
      self.tagNew = value;
    },
    setActiveEntryEditField(value: activeEntryEditField) {
      self.activeEntryEditField = value;
    },
    setAppMode(value: appMode) {
      self.appMode = value;
    },
    setTagSearch(value: boolean) {
      self.tagSearch = value;
    },
    setTagSelectedID(value: string) {
      self.tagSelectedID = value;
    },
    setTagSearchString(value: string) {
      self.tagSearchString = value;
    },
    setEntrySearchString(value: string) {
      self.entrySearchString = value;
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

export const defaultStateStringified: string = JSON.stringify(defaultState);

const localStorageKey = 'mst-tearleads-' + environment();
const initialState = localStorage.getItem(localStorageKey);
let state: appState;
if (initialState !== null) {
  state = JSON.parse(initialState);
} else {
  state = defaultState;
}

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

  // It is possible that the model structure changes which would break the ability
  // to restore a snapshot.  If a snapshot restore fails, apply the default state.
  try {
    applySnapshot(store, snapshotMergedIntoDefaults);
  } catch (e) {
    applySnapshot(store, defaultState);
  }

  // connect local storage
  snapshotListener = onSnapshot(store, snapshot => {
    console.info('=== taking a snapshot');
    localStorage.setItem(localStorageKey, JSON.stringify(snapshot));
  });
  return store;
}

let store: ReturnType<typeof createAppStateStore>;
store = createAppStateStore(state);

export type TStore = ReturnType<typeof createAppStateStore>;
export {store};
