import Dexie, {type Table} from 'dexie';
import type {ITagJsonApi} from '../models/TagModel';
import type {ITagTextEntryThroughModelJsonApi} from '../models/TagTextEntryThroughModel';
import type {ITextEntryJsonApi} from '../models/TextEntryModel';
import type {IUserJsonApi} from '../models/UserModel';
import type {
  AdapterConfig,
  IPersistenceAdapter,
  QueryFilter,
  SyncMetadata,
} from './types';

class TearleadsDB extends Dexie {
  tags!: Table<ITagJsonApi>;
  textEntries!: Table<ITextEntryJsonApi>;
  untaggedTextEntries!: Table<ITextEntryJsonApi>;
  tagTextEntryRelations!: Table<ITagTextEntryThroughModelJsonApi>;
  users!: Table<IUserJsonApi>;
  syncMetadata!: Table<SyncMetadata>;

  constructor(name: string) {
    super(name);
    this.version(1).stores({
      tags: 'id, attributes.date_updated, relationships.user.data.id',
      textEntries: 'id, attributes.date_updated, relationships.user.data.id',
      untaggedTextEntries:
        'id, attributes.date_updated, relationships.user.data.id',
      tagTextEntryRelations:
        'id, relationships.tag.data.id, relationships.text_entry.data.id',
      users: 'id, attributes.username',
      syncMetadata: 'id',
    });
  }
}

export class DexieAdapter implements IPersistenceAdapter {
  private db: TearleadsDB;

  constructor(config: AdapterConfig) {
    this.db = new TearleadsDB(config.name || 'tearleads-db');
  }

  async initialize(): Promise<void> {
    await this.db.open();
  }

  // Tags
  async getTags(filter?: QueryFilter): Promise<ITagJsonApi[]> {
    let query = this.db.tags.toCollection();

    if (filter?.userId) {
      query = this.db.tags
        .where('relationships.user.data.id')
        .equals(filter.userId);
    }

    if (filter?.since) {
      const results = await query.toArray();
      return results.filter(
        tag => new Date(tag.attributes.date_updated) > new Date(filter.since!)
      );
    }

    let results = await query.toArray();

    if (filter?.limit) {
      const offset = filter.offset || 0;
      results = results.slice(offset, offset + filter.limit);
    }

    return results;
  }

  async getTag(id: string): Promise<ITagJsonApi | null> {
    return (await this.db.tags.get(id)) || null;
  }

  async saveTags(tags: ITagJsonApi[]): Promise<void> {
    await this.db.tags.bulkPut(tags);
  }

  async saveTag(tag: ITagJsonApi): Promise<void> {
    await this.db.tags.put(tag);
  }

  async deleteTag(id: string): Promise<void> {
    await this.db.tags.delete(id);
  }

  // Text Entries
  async getTextEntries(filter?: QueryFilter): Promise<ITextEntryJsonApi[]> {
    let query = this.db.textEntries.toCollection();

    if (filter?.userId) {
      query = this.db.textEntries
        .where('relationships.user.data.id')
        .equals(filter.userId);
    }

    if (filter?.since) {
      const results = await query.toArray();
      return results.filter(
        entry =>
          new Date(entry.attributes.date_updated) > new Date(filter.since!)
      );
    }

    let results = await query.toArray();

    // If we need to filter by tag, we need to join with relations
    if (filter?.tagId) {
      const relations = await this.db.tagTextEntryRelations
        .where('relationships.tag.data.id')
        .equals(filter.tagId)
        .toArray();

      const entryIds = new Set(
        relations.map(r => r.relationships.text_entry.data.id)
      );
      results = results.filter(entry => entryIds.has(entry.id));
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      results = results.slice(offset, offset + filter.limit);
    }

    return results;
  }

  async getTextEntry(id: string): Promise<ITextEntryJsonApi | null> {
    return (await this.db.textEntries.get(id)) || null;
  }

  async saveTextEntries(entries: ITextEntryJsonApi[]): Promise<void> {
    await this.db.textEntries.bulkPut(entries);
  }

  async saveTextEntry(entry: ITextEntryJsonApi): Promise<void> {
    await this.db.textEntries.put(entry);
  }

  async deleteTextEntry(id: string): Promise<void> {
    await this.db.textEntries.delete(id);
  }

  // Untagged Text Entries
  async getUntaggedTextEntries(
    filter?: QueryFilter
  ): Promise<ITextEntryJsonApi[]> {
    let query = this.db.untaggedTextEntries.toCollection();

    if (filter?.userId) {
      query = this.db.untaggedTextEntries
        .where('relationships.user.data.id')
        .equals(filter.userId);
    }

    if (filter?.since) {
      const results = await query.toArray();
      return results.filter(
        entry =>
          new Date(entry.attributes.date_updated) > new Date(filter.since!)
      );
    }

    let results = await query.toArray();

    if (filter?.limit) {
      const offset = filter.offset || 0;
      results = results.slice(offset, offset + filter.limit);
    }

    return results;
  }

  async saveUntaggedTextEntries(entries: ITextEntryJsonApi[]): Promise<void> {
    await this.db.untaggedTextEntries.bulkPut(entries);
  }

  async deleteUntaggedTextEntry(id: string): Promise<void> {
    await this.db.untaggedTextEntries.delete(id);
  }

  // Tag-TextEntry relationships
  async getTagTextEntryRelations(
    filter?: QueryFilter
  ): Promise<ITagTextEntryThroughModelJsonApi[]> {
    let results: ITagTextEntryThroughModelJsonApi[];

    if (filter?.tagId) {
      results = await this.db.tagTextEntryRelations
        .where('relationships.tag.data.id')
        .equals(filter.tagId)
        .toArray();
    } else {
      results = await this.db.tagTextEntryRelations.toArray();
    }

    if (filter?.since) {
      results = results.filter(
        relation =>
          new Date(relation.attributes.date_updated) > new Date(filter.since!)
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      results = results.slice(offset, offset + filter.limit);
    }

    return results;
  }

  async saveTagTextEntryRelations(
    relations: ITagTextEntryThroughModelJsonApi[]
  ): Promise<void> {
    await this.db.tagTextEntryRelations.bulkPut(relations);
  }

  async deleteTagTextEntryRelation(id: string): Promise<void> {
    await this.db.tagTextEntryRelations.delete(id);
  }

  // Users
  async getUsers(filter?: QueryFilter): Promise<IUserJsonApi[]> {
    let results = await this.db.users.toArray();

    if (filter?.since) {
      results = results.filter(
        user => new Date(user.attributes.date_updated) > new Date(filter.since!)
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      results = results.slice(offset, offset + filter.limit);
    }

    return results;
  }

  async getUser(id: string): Promise<IUserJsonApi | null> {
    return (await this.db.users.get(id)) || null;
  }

  async saveUsers(users: IUserJsonApi[]): Promise<void> {
    await this.db.users.bulkPut(users);
  }

  async saveUser(user: IUserJsonApi): Promise<void> {
    await this.db.users.put(user);
  }

  // Sync metadata
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    const metadata = await this.db.syncMetadata.get('main');
    return metadata || null;
  }

  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    await this.db.syncMetadata.put({...metadata, id: 'main'} as any);
  }

  // Bulk operations
  async clear(): Promise<void> {
    await this.db.transaction(
      'rw',
      [
        this.db.tags,
        this.db.textEntries,
        this.db.untaggedTextEntries,
        this.db.tagTextEntryRelations,
        this.db.users,
        this.db.syncMetadata,
      ],
      async () => {
        await Promise.all([
          this.db.tags.clear(),
          this.db.textEntries.clear(),
          this.db.untaggedTextEntries.clear(),
          this.db.tagTextEntryRelations.clear(),
          this.db.users.clear(),
          this.db.syncMetadata.clear(),
        ]);
      }
    );
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    return await this.db.transaction(
      'rw',
      [
        this.db.tags,
        this.db.textEntries,
        this.db.untaggedTextEntries,
        this.db.tagTextEntryRelations,
        this.db.users,
      ],
      operation
    );
  }
}
