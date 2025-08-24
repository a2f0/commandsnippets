import {types} from 'mobx-state-tree';
import {
  activeEntryEditField,
  activeSearch,
  activeTagEditField,
  appMode,
  entrySearchMethod,
} from '../../shared';

// This model contains only UI-related volatile state
// All domain data is managed through the repository
export const UIStateModel = types
  .model('UIStateModel', {
    // User session
    loggedInUser: types.maybeNull(types.string),
    currentUser: types.maybeNull(types.string),

    // UI preferences
    selectedTheme: types.string,
    showTagCounts: types.boolean,

    // Sorting preferences
    tagSortOrder: types.string,
    tagTextEntryThroughModelSortOrder: types.string,
    entrySortOrder: types.string,

    // Current selections
    currentTag: types.maybeNull(types.string),

    // Search state
    tagSearch: types.boolean,

    // Clipboard state
    mostRecentCopyType: types.maybeNull(types.string),
    mostRecentCopyID: types.maybeNull(types.string),

    // New entry/tag input buffers
    entryNew: types.maybeNull(types.string),
    tagNew: types.maybeNull(types.string),
  })
  .volatile<{
    // Volatile UI state that doesn't need persistence
    activeSearch: activeSearch;
    activeEntryEditField: activeEntryEditField;
    activeTagEditField: activeTagEditField;
    clickCount: number;
    entrySelectedID: string;
    entrySearchString: string;
    entrySearchMethod: entrySearchMethod;
    tagSearchString: string;
    tagSelectedID: string;
    appMode: appMode;
    isSyncing: boolean;
    lastSyncTime: Date | null;
    syncError: string | null;
  }>(() => ({
    activeSearch: activeSearch.tags,
    activeEntryEditField: activeEntryEditField.subject,
    activeTagEditField: activeTagEditField.name,
    clickCount: 0,
    entrySelectedID: '',
    entrySearchString: '',
    entrySearchMethod: entrySearchMethod.currentTagOnly,
    tagSearchString: '',
    tagSelectedID: '',
    appMode: appMode.tagsList,
    isSyncing: false,
    lastSyncTime: null,
    syncError: null,
  }))
  .actions(self => ({
    // User session actions
    setLoggedInUser(handle: string | null) {
      self.loggedInUser = handle;
    },

    setCurrentUser(value: string | null) {
      self.currentUser = value;
    },

    // UI preference actions
    setSelectedTheme(theme: string) {
      self.selectedTheme = theme;
    },

    setShowTagCounts(value: boolean) {
      self.showTagCounts = value;
    },

    // Sorting actions
    setTagSortOrder(order: string) {
      self.tagSortOrder = order;
    },

    setTagTextEntryThroughModelSortOrder(order: string) {
      self.tagTextEntryThroughModelSortOrder = order;
    },

    setEntrySortOrder(order: string) {
      self.entrySortOrder = order;
    },

    // Selection actions
    setCurrentTag(value: string | null) {
      self.currentTag = value;
    },

    setEntrySelectedID(value: string) {
      self.entrySelectedID = value;
    },

    setTagSelectedID(value: string) {
      self.tagSelectedID = value;
    },

    // Search actions
    setActiveSearch(activeSearch: activeSearch) {
      self.activeSearch = activeSearch;
    },

    setTagSearch(value: boolean) {
      self.tagSearch = value;
    },

    setTagSearchString(value: string) {
      self.tagSearchString = value;
    },

    setEntrySearchString(value: string) {
      self.entrySearchString = value;
    },

    setEntrySearchMethod(method: entrySearchMethod) {
      self.entrySearchMethod = method;
    },

    // Edit field actions
    setActiveEntryEditField(value: activeEntryEditField) {
      self.activeEntryEditField = value;
    },

    setActiveTagEditField(value: activeTagEditField) {
      self.activeTagEditField = value;
    },

    // New entry/tag actions
    setEntryNew(value: string | null) {
      self.entryNew = value;
    },

    setTagNew(value: string | null) {
      self.tagNew = value;
    },

    // App mode actions
    setAppMode(value: appMode) {
      self.appMode = value;
    },

    // Clipboard actions
    setMostRecentCopyType(value: string) {
      self.mostRecentCopyType = value;
    },

    setMostRecentCopyID(value: string) {
      self.mostRecentCopyID = value;
    },

    // Misc actions
    incrementClickCount() {
      self.clickCount += 1;
    },

    // Sync status actions
    setSyncStatus(isSyncing: boolean, error?: string) {
      self.isSyncing = isSyncing;
      if (!isSyncing && !error) {
        self.lastSyncTime = new Date();
        self.syncError = null;
      } else if (error) {
        self.syncError = error;
      }
    },
  }));
