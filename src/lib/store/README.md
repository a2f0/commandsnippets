# Store Architecture - Repository Pattern Implementation

## Overview

This implementation separates UI state from domain data using the Repository Pattern with pluggable persistence adapters.

## Architecture

```
┌─────────────────┐
│   UI Components │
└────────┬────────┘
         │
┌────────▼────────┐
│   MobX Store    │
│   (RootStore)   │
├─────────────────┤
│ • UI State      │
│ • Cached Data   │
└────────┬────────┘
         │
┌────────▼────────┐
│   Repository    │
│ (DataRepository)│
├─────────────────┤
│ • Business Logic│
│ • Sync Logic    │
└────────┬────────┘
         │
┌────────▼────────┐
│ Adapter Interface│
└────────┬────────┘
         │
    ┌────┴────┐
    │         │
┌───▼───┐ ┌──▼──────┐
│ Dexie │ │ LocalSt │
│Adapter│ │ Adapter │
└───────┘ └─────────┘
```

## Key Components

### 1. UIStateModel (`models/UIStateModel.ts`)
- Contains only UI-related state (selections, search strings, view modes)
- Volatile state that doesn't require complex persistence
- Can be optionally persisted to localStorage for user preferences

### 2. RootStore (`models/RootStore.ts`)
- Combines UIStateModel with cached domain data
- Provides computed views for accessing data
- All data operations go through the repository

### 3. DataRepository (`repository/DataRepository.ts`)
- Manages all data operations
- Handles syncing with remote API
- Abstracts away the persistence layer
- Implements business logic for data consistency

### 4. Persistence Adapters
- **DexieAdapter**: Uses IndexedDB for robust offline storage
- **LocalStorageAdapter**: Fallback for simpler persistence
- Easy to add new adapters (e.g., SQLite, Remote API)

## Usage

### Basic Setup

```typescript
import {createStoreV2} from './lib/store/storeV2';

// Create store with Dexie/IndexedDB (default)
const store = await createStoreV2();

// Or use localStorage adapter
const store = await createStoreV2({
  adapterType: 'localStorage',
  enableAutoSync: true,
  syncInterval: 60000, // 1 minute
});
```

### Migrating from Old Store

```typescript
import {migrateFromOldStore} from './lib/store/storeV2';

// Get snapshot from old store
const oldStoreData = getSnapshot(oldStore);

// Migrate to new architecture
const newStore = await migrateFromOldStore(oldStoreData);
```

### Accessing Data

```typescript
// UI state is accessed directly
store.uiState.setCurrentTag('my-tag');
store.uiState.setEntrySearchString('search term');

// Domain data is accessed through cached views
const tags = store.tags;
const entries = store.textEntries;
const userTags = store.getTagsByUser(userId);

// Data operations go through actions
await store.fetchTags(username);
await store.fetchTextEntries(username, tagName);
await store.addTag(newTag);
await store.removeTag(tagId);
```

## Benefits

1. **Separation of Concerns**: UI state is separate from domain data
2. **Offline-First**: IndexedDB provides robust offline storage
3. **Pluggable Persistence**: Easy to switch between storage backends
4. **Better Testing**: Mock adapters for tests
5. **Optimized Performance**: Cached data for fast UI updates
6. **Sync Management**: Built-in sync with conflict resolution

## Migration Notes

The new architecture maintains compatibility with existing data structures while providing:
- Better separation between UI and domain concerns
- More robust offline capabilities
- Easier testing and maintenance
- Foundation for advanced features (conflict resolution, partial sync, etc.)

## Next Steps

To fully integrate this architecture:

1. Update React components to use the new store
2. Implement comprehensive sync logic with conflict resolution
3. Add error recovery and retry mechanisms
4. Implement data validation at the repository level
5. Add support for optimistic updates
6. Create adapter for direct API access (bypassing local storage)
