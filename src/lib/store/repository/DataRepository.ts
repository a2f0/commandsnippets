import type {IPersistenceAdapter, QueryFilter} from '../adapters/types';
import type {ITagJsonApi} from '../models/TagModel';
import {TagHelpers} from '../models/TagModel';
import type {ITagTextEntryThroughModelJsonApi} from '../models/TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from '../models/TextEntryModel';
import {TextEntryHelpers} from '../models/TextEntryModel';
import type {IUserJsonApi} from '../models/UserModel';

export interface RepositoryConfig {
  adapter: IPersistenceAdapter;
  enableAutoSync: boolean;
  syncInterval: number; // milliseconds
  onSyncStart?: () => void;
  onSyncComplete?: (success: boolean, error?: Error) => void;
}

export class DataRepository {
  private adapter: IPersistenceAdapter;
  private config: RepositoryConfig;
  private syncTimer?: ReturnType<typeof setInterval> | undefined;
  private isSyncing = false;

  constructor(config: RepositoryConfig) {
    this.config = config;
    this.adapter = config.adapter;
  }

  async initialize(): Promise<void> {
    await this.adapter.initialize();

    if (this.config.enableAutoSync) {
      this.startAutoSync();
    }
  }

  // --- Tags ---
  async getTags(userId?: string, since?: string): Promise<ITagJsonApi[]> {
    const filter: QueryFilter = {};
    if (userId) filter.userId = userId;
    if (since) filter.since = since;
    return await this.adapter.getTags(filter);
  }

  async getTag(id: string): Promise<ITagJsonApi | null> {
    return await this.adapter.getTag(id);
  }

  async saveTag(tag: ITagJsonApi): Promise<void> {
    await this.adapter.saveTag(tag);
  }

  async deleteTag(id: string): Promise<void> {
    await this.adapter.deleteTag(id);
    // Also delete related junction records using bulk operation
    const relations = await this.adapter.getTagTextEntryRelations();
    const toDelete = relations
      .filter(r => r.relationships.tag.data.id === id)
      .map(r => r.id);
    if (toDelete.length > 0) {
      await this.adapter.bulkDeleteTagTextEntryRelations(toDelete);
    }
  }

  async syncTags(username: string): Promise<void> {
    try {
      // Get local tags for this user
      const user = await this.getUserByUsername(username);
      const localTags = user ? await this.getTags(user.id) : [];

      // Get most recent timestamp
      const mostRecentTimestamp = TagHelpers.getMostRecentTimeStamp(localTags);

      // Fetch from API
      const remoteData = await TagHelpers.fetch(
        [],
        username,
        1,
        mostRecentTimestamp
      );

      // Process and save the fetched data
      await this.reconcileCollection(remoteData);
    } catch (error) {
      console.error('Failed to sync tags:', error);
      throw error;
    }
  }

  // --- Text Entries ---
  async getTextEntries(
    userId?: string,
    tagId?: string,
    since?: string
  ): Promise<ITextEntryJsonApi[]> {
    const filter: QueryFilter = {};
    if (userId) filter.userId = userId;
    if (tagId) filter.tagId = tagId;
    if (since) filter.since = since;
    return await this.adapter.getTextEntries(filter);
  }

  async getTextEntry(id: string): Promise<ITextEntryJsonApi | null> {
    return await this.adapter.getTextEntry(id);
  }

  async saveTextEntry(entry: ITextEntryJsonApi): Promise<void> {
    await this.adapter.saveTextEntry(entry);
  }

  async deleteTextEntry(id: string): Promise<void> {
    await this.adapter.deleteTextEntry(id);
    // Also delete related junction records using bulk operation
    const relations = await this.adapter.getTagTextEntryRelations();
    const toDelete = relations
      .filter(r => r.relationships.text_entry.data.id === id)
      .map(r => r.id);
    if (toDelete.length > 0) {
      await this.adapter.bulkDeleteTagTextEntryRelations(toDelete);
    }
  }

  async syncTextEntries(username: string, tagName: string): Promise<void> {
    try {
      const user = await this.getUserByUsername(username);
      const tag = await this.getTagByName(tagName, user?.id);

      if (!user || !tag) {
        throw new Error('User or tag not found');
      }

      const localEntries = await this.getTextEntries(user.id, tag.id);
      const mostRecentTimestamp =
        TextEntryHelpers.getMostRecentTimeStamp(localEntries);

      const remoteData = await TextEntryHelpers.fetch(
        [],
        username,
        tagName,
        1,
        mostRecentTimestamp,
        null
      );

      await this.reconcileCollection(remoteData);
    } catch (error) {
      console.error('Failed to sync text entries:', error);
      throw error;
    }
  }

  // --- Untagged Text Entries ---
  async getUntaggedTextEntries(
    userId?: string,
    since?: string
  ): Promise<ITextEntryJsonApi[]> {
    const filter: QueryFilter = {};
    if (userId) filter.userId = userId;
    if (since) filter.since = since;
    return await this.adapter.getUntaggedTextEntries(filter);
  }

  async saveUntaggedTextEntry(entry: ITextEntryJsonApi): Promise<void> {
    await this.adapter.saveUntaggedTextEntries([entry]);
  }

  async deleteUntaggedTextEntry(id: string): Promise<void> {
    await this.adapter.deleteUntaggedTextEntry(id);
  }

  async syncUntaggedTextEntries(username: string): Promise<void> {
    try {
      const user = await this.getUserByUsername(username);
      const localEntries = user
        ? await this.getUntaggedTextEntries(user.id)
        : [];
      const mostRecentTimestamp =
        TextEntryHelpers.getMostRecentTimeStamp(localEntries);

      const remoteData = await TextEntryHelpers.fetch(
        [],
        username,
        null,
        1,
        mostRecentTimestamp,
        0
      );

      // Handle untagged entries specially
      const textEntries = remoteData.filter(
        (item): item is ITextEntryJsonApi => item.type === 'TextEntry'
      );

      if (textEntries.length > 0) {
        await this.adapter.saveUntaggedTextEntries(textEntries);
      }

      // Save other related data (users, etc)
      const otherData = remoteData.filter(item => item.type !== 'TextEntry');
      if (otherData.length > 0) {
        await this.reconcileCollection(otherData);
      }
    } catch (error) {
      console.error('Failed to sync untagged text entries:', error);
      throw error;
    }
  }

  // --- Tag-TextEntry Relations ---
  async getTagTextEntryRelations(
    tagId?: string
  ): Promise<ITagTextEntryThroughModelJsonApi[]> {
    const filter: QueryFilter = {};
    if (tagId) filter.tagId = tagId;
    return await this.adapter.getTagTextEntryRelations(filter);
  }

  async saveTagTextEntryRelation(
    relation: ITagTextEntryThroughModelJsonApi
  ): Promise<void> {
    await this.adapter.saveTagTextEntryRelations([relation]);
  }

  async deleteTagTextEntryRelation(id: string): Promise<void> {
    await this.adapter.deleteTagTextEntryRelation(id);
  }

  // --- Users ---
  async getUsers(): Promise<IUserJsonApi[]> {
    return await this.adapter.getUsers();
  }

  async getUser(id: string): Promise<IUserJsonApi | null> {
    return await this.adapter.getUser(id);
  }

  async getUserByUsername(username: string): Promise<IUserJsonApi | null> {
    const users = await this.getUsers();
    return users.find(u => u.attributes.username === username) || null;
  }

  async saveUser(user: IUserJsonApi): Promise<void> {
    await this.adapter.saveUser(user);
  }

  // Batch save methods for migration
  async saveUsers(users: IUserJsonApi[]): Promise<void> {
    await this.adapter.saveUsers(users);
  }

  async saveTags(tags: ITagJsonApi[]): Promise<void> {
    await this.adapter.saveTags(tags);
  }

  async saveTextEntries(entries: ITextEntryJsonApi[]): Promise<void> {
    await this.adapter.saveTextEntries(entries);
  }

  async saveUntaggedTextEntries(entries: ITextEntryJsonApi[]): Promise<void> {
    await this.adapter.saveUntaggedTextEntries(entries);
  }

  async saveTagTextEntryRelations(
    relations: ITagTextEntryThroughModelJsonApi[]
  ): Promise<void> {
    await this.adapter.saveTagTextEntryRelations(relations);
  }

  // --- Helper Methods ---
  private async getTagByName(
    name: string,
    userId?: string
  ): Promise<ITagJsonApi | null> {
    const tags = await this.getTags(userId);
    return tags.find(t => t.attributes.name === name) || null;
  }

  private async reconcileCollection(
    collection: Array<
      | ITextEntryJsonApi
      | ITagTextEntryThroughModelJsonApi
      | IUserJsonApi
      | ITagJsonApi
    >
  ): Promise<void> {
    // Group by type
    const textEntries = collection.filter(
      (item): item is ITextEntryJsonApi => item.type === 'TextEntry'
    );
    const tags = collection.filter(
      (item): item is ITagJsonApi => item.type === 'Tag'
    );
    const relations = collection.filter(
      (item): item is ITagTextEntryThroughModelJsonApi =>
        item.type === 'TagTextEntryThroughModel'
    );
    const users = collection.filter(
      (item): item is IUserJsonApi => item.type === 'User'
    );

    // Save in transaction if adapter supports it
    await this.adapter.transaction(async () => {
      if (users.length > 0) {
        await this.adapter.saveUsers(users);
      }
      if (tags.length > 0) {
        await this.adapter.saveTags(tags);
      }
      if (textEntries.length > 0) {
        await this.adapter.saveTextEntries(textEntries);
      }
      if (relations.length > 0) {
        await this.adapter.saveTagTextEntryRelations(relations);
      }
    });
  }

  // --- Sync Management ---
  private startAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    this.syncTimer = setInterval(async () => {
      if (!this.isSyncing) {
        await this.performSync();
      }
    }, this.config.syncInterval);
  }

  async performSync(): Promise<void> {
    if (this.isSyncing) return;

    this.isSyncing = true;
    this.config.onSyncStart?.();

    try {
      // Get sync metadata to determine what needs syncing
      await this.adapter.getSyncMetadata();

      // TODO: Implement comprehensive sync logic
      // This would involve:
      // 1. Checking for local changes
      // 2. Fetching remote changes
      // 3. Resolving conflicts
      // 4. Updating sync metadata

      this.config.onSyncComplete?.(true);
    } catch (error) {
      console.error('Sync failed:', error);
      this.config.onSyncComplete?.(false, error as Error);
    } finally {
      this.isSyncing = false;
    }
  }

  stopAutoSync(): void {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = undefined;
    }
  }

  async clearAll(): Promise<void> {
    await this.adapter.clear();
  }

  destroy(): void {
    this.stopAutoSync();
  }
}
