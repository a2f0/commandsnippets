import type {ITagJsonApi} from '../models/TagModel';
import type {ITagTextEntryThroughModelJsonApi} from '../models/TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from '../models/TextEntryModel';
import type {IUserJsonApi} from '../models/UserModel';

// Query filters for fetching data
export interface QueryFilter {
  userId?: string;
  tagId?: string;
  since?: string; // timestamp for incremental sync
  limit?: number;
  offset?: number;
}

// Sync metadata for tracking changes
export interface SyncMetadata {
  lastSyncTimestamp: string;
  localChanges: string[]; // IDs of entities with local changes
  conflicts: Array<{
    entityId: string;
    entityType: string;
    localVersion: any;
    remoteVersion: any;
  }>;
}

// Persistence adapter interface
export interface IPersistenceAdapter {
  // Initialize the adapter (create tables, establish connections, etc.)
  initialize(): Promise<void>;

  // Tags
  getTags(filter?: QueryFilter): Promise<ITagJsonApi[]>;
  getTag(id: string): Promise<ITagJsonApi | null>;
  saveTags(tags: ITagJsonApi[]): Promise<void>;
  saveTag(tag: ITagJsonApi): Promise<void>;
  deleteTag(id: string): Promise<void>;

  // Text Entries
  getTextEntries(filter?: QueryFilter): Promise<ITextEntryJsonApi[]>;
  getTextEntry(id: string): Promise<ITextEntryJsonApi | null>;
  saveTextEntries(entries: ITextEntryJsonApi[]): Promise<void>;
  saveTextEntry(entry: ITextEntryJsonApi): Promise<void>;
  deleteTextEntry(id: string): Promise<void>;

  // Untagged Text Entries
  getUntaggedTextEntries(filter?: QueryFilter): Promise<ITextEntryJsonApi[]>;
  saveUntaggedTextEntries(entries: ITextEntryJsonApi[]): Promise<void>;
  deleteUntaggedTextEntry(id: string): Promise<void>;

  // Tag-TextEntry relationships
  getTagTextEntryRelations(
    filter?: QueryFilter
  ): Promise<ITagTextEntryThroughModelJsonApi[]>;
  saveTagTextEntryRelations(
    relations: ITagTextEntryThroughModelJsonApi[]
  ): Promise<void>;
  deleteTagTextEntryRelation(id: string): Promise<void>;

  // Users
  getUsers(filter?: QueryFilter): Promise<IUserJsonApi[]>;
  getUser(id: string): Promise<IUserJsonApi | null>;
  saveUsers(users: IUserJsonApi[]): Promise<void>;
  saveUser(user: IUserJsonApi): Promise<void>;

  // Sync metadata
  getSyncMetadata(): Promise<SyncMetadata | null>;
  saveSyncMetadata(metadata: SyncMetadata): Promise<void>;

  // Bulk operations
  clear(): Promise<void>;
  transaction<T>(operation: () => Promise<T>): Promise<T>;
}

// Adapter configuration
export interface AdapterConfig {
  name: string;
  version?: number;
  autoSync?: boolean;
  syncInterval?: number; // milliseconds
}
