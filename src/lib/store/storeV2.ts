import {type Instance, onSnapshot} from 'mobx-state-tree';
import {environment} from '../environment';
import {defaultState} from '../shared';
import {DexieAdapter} from './adapters/DexieAdapter';
import {LocalStorageAdapter} from './adapters/LocalStorageAdapter';
import type {IPersistenceAdapter} from './adapters/types';
import {RootStore} from './models/RootStore';
import type {ITagJsonApi} from './models/TagModel';
import type {ITagTextEntryThroughModelJsonApi} from './models/TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from './models/TextEntryModel';
import type {IUserJsonApi} from './models/UserModel';
import {DataRepository} from './repository/DataRepository';

// Configuration for which adapter to use
export interface StoreConfig {
  adapterType?: 'dexie' | 'localStorage';
  enableAutoSync?: boolean;
  syncInterval?: number;
  persistUIState?: boolean;
}

// Default configuration
const defaultConfig: StoreConfig = {
  adapterType: 'dexie',
  enableAutoSync: true,
  syncInterval: 30000, // 30 seconds
  persistUIState: true,
};

// Create the persistence adapter based on configuration
function createAdapter(type: 'dexie' | 'localStorage'): IPersistenceAdapter {
  switch (type) {
    case 'dexie':
      return new DexieAdapter({
        name: `tearleads-${environment}`,
        version: 1,
      });
    case 'localStorage':
      return new LocalStorageAdapter({
        name: environment,
      });
    default:
      throw new Error(`Unknown adapter type: ${type}`);
  }
}

// Create and initialize the store
export async function createStoreV2(
  config: StoreConfig = {}
): Promise<Instance<typeof RootStore>> {
  const finalConfig = {...defaultConfig, ...config};
  // Create the adapter
  const adapter = createAdapter(finalConfig.adapterType || 'dexie');

  // Create the repository
  const repository = new DataRepository({
    adapter,
    enableAutoSync: finalConfig.enableAutoSync ?? false,
    syncInterval: finalConfig.syncInterval ?? 30000,
    onSyncStart: () => {
      console.log('Sync started...');
    },
    onSyncComplete: (success, error) => {
      if (success) {
        console.log('Sync completed successfully');
      } else {
        console.error('Sync failed:', error);
      }
    },
  });

  // Initialize the repository
  await repository.initialize();

  // Create the store with default UI state
  const uiStateDefaults = {
    loggedInUser: defaultState.loggedInUser,
    currentUser: null, // This is a new field not in defaultState
    selectedTheme: defaultState.selectedTheme,
    showTagCounts: defaultState.showTagCounts,
    tagSortOrder: defaultState.tagSortOrder,
    tagTextEntryThroughModelSortOrder:
      defaultState.tagTextEntryThroughModelSortOrder,
    entrySortOrder: defaultState.entrySortOrder,
    currentTag: null, // This is a new field not in defaultState
    tagSearch: defaultState.tagSearch,
    mostRecentCopyType: defaultState.mostRecentCopyType,
    mostRecentCopyID: defaultState.mostRecentCopyID,
    entryNew: defaultState.entryNew,
    tagNew: defaultState.tagNew,
  };

  // Try to restore UI state from localStorage if enabled
  let restoredUIState = uiStateDefaults;
  if (finalConfig.persistUIState) {
    const savedUIState = localStorage.getItem(
      `tearleads-ui-state-${environment}`
    );
    if (savedUIState) {
      try {
        restoredUIState = {...uiStateDefaults, ...JSON.parse(savedUIState)};
      } catch (e) {
        console.warn('Failed to restore UI state:', e);
      }
    }
  }

  // Create the store
  const store = RootStore.create({
    uiState: restoredUIState,
  });

  // Set the repository
  store.setRepository(repository);

  // Load initial data from repository
  await store.loadFromRepository();

  // Set up UI state persistence if enabled
  if (finalConfig.persistUIState) {
    onSnapshot(store.uiState, snapshot => {
      localStorage.setItem(
        `tearleads-ui-state-${environment}`,
        JSON.stringify(snapshot)
      );
    });
  }

  return store;
}

// Interface for old store data structure
interface OldStoreData {
  usersArray?: IUserJsonApi[];
  tagsArray?: ITagJsonApi[];
  textEntriesArray?: ITextEntryJsonApi[];
  untaggedTextEntriesArray?: ITextEntryJsonApi[];
  tagTextEntryThroughModel?: ITagTextEntryThroughModelJsonApi[];
  // UI state properties
  loggedInUser?: string;
  currentUser?: string | null;
  selectedTheme?: string;
  showTagCounts?: boolean;
  tagSortOrder?: string;
  entrySortOrder?: string;
  currentTag?: string | null;
  tagSearch?: boolean;
  mostRecentCopyType?: string;
  mostRecentCopyID?: string;
  entryNew?: string;
  tagNew?: string;
}

// Migration helper to migrate from old store to new store
export async function migrateFromOldStore(
  oldStoreData: OldStoreData | null | undefined,
  config?: StoreConfig
): Promise<Instance<typeof RootStore>> {
  const store = await createStoreV2(config);

  if (!store.repository) {
    throw new Error('Repository not initialized');
  }

  // Migrate data from old store format
  if (oldStoreData) {
    // Save users
    if (oldStoreData.usersArray && oldStoreData.usersArray.length > 0) {
      await store.repository.saveUsers(oldStoreData.usersArray);
    }

    // Save tags
    if (oldStoreData.tagsArray && oldStoreData.tagsArray.length > 0) {
      await store.repository.saveTags(oldStoreData.tagsArray);
    }

    // Save text entries
    if (
      oldStoreData.textEntriesArray &&
      oldStoreData.textEntriesArray.length > 0
    ) {
      await store.repository.saveTextEntries(oldStoreData.textEntriesArray);
    }

    // Save untagged text entries
    if (
      oldStoreData.untaggedTextEntriesArray &&
      oldStoreData.untaggedTextEntriesArray.length > 0
    ) {
      await store.repository.saveUntaggedTextEntries(
        oldStoreData.untaggedTextEntriesArray
      );
    }

    // Save tag-text entry relations
    if (
      oldStoreData.tagTextEntryThroughModel &&
      oldStoreData.tagTextEntryThroughModel.length > 0
    ) {
      await store.repository.saveTagTextEntryRelations(
        oldStoreData.tagTextEntryThroughModel
      );
    }

    // Reload from repository to populate caches
    await store.loadFromRepository();

    // Migrate UI state
    if (oldStoreData.loggedInUser)
      store.uiState.setLoggedInUser(oldStoreData.loggedInUser);
    if (oldStoreData.currentUser)
      store.uiState.setCurrentUser(oldStoreData.currentUser);
    if (oldStoreData.selectedTheme)
      store.uiState.setSelectedTheme(oldStoreData.selectedTheme);
    if (oldStoreData.showTagCounts !== undefined)
      store.uiState.setShowTagCounts(oldStoreData.showTagCounts);
    if (oldStoreData.tagSortOrder)
      store.uiState.setTagSortOrder(oldStoreData.tagSortOrder);
    if (oldStoreData.entrySortOrder)
      store.uiState.setEntrySortOrder(oldStoreData.entrySortOrder);
    if (oldStoreData.currentTag)
      store.uiState.setCurrentTag(oldStoreData.currentTag);
    if (oldStoreData.tagSearch !== undefined)
      store.uiState.setTagSearch(oldStoreData.tagSearch);
    if (oldStoreData.mostRecentCopyType)
      store.uiState.setMostRecentCopyType(oldStoreData.mostRecentCopyType);
    if (oldStoreData.mostRecentCopyID)
      store.uiState.setMostRecentCopyID(oldStoreData.mostRecentCopyID);
    if (oldStoreData.entryNew) store.uiState.setEntryNew(oldStoreData.entryNew);
    if (oldStoreData.tagNew) store.uiState.setTagNew(oldStoreData.tagNew);
  }

  return store;
}

// Example usage
let storeV2Instance: Instance<typeof RootStore> | null = null;

export async function getStoreV2(): Promise<Instance<typeof RootStore>> {
  if (!storeV2Instance) {
    storeV2Instance = await createStoreV2();
  }
  return storeV2Instance;
}

export type StoreV2 = Instance<typeof RootStore>;
