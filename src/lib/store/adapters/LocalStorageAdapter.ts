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

export class LocalStorageAdapter implements IPersistenceAdapter {
  private keyPrefix: string;

  constructor(config: AdapterConfig) {
    this.keyPrefix = `tearleads-${config.name}-`;
  }

  private getKey(collection: string): string {
    return `${this.keyPrefix}${collection}`;
  }

  private load<T>(collection: string): T[] {
    const data = localStorage.getItem(this.getKey(collection));
    return data ? JSON.parse(data) : [];
  }

  private save<T>(collection: string, data: T[]): void {
    localStorage.setItem(this.getKey(collection), JSON.stringify(data));
  }

  private loadOne<T extends {id: string}>(
    collection: string,
    id: string
  ): T | null {
    const items = this.load<T>(collection);
    return items.find(item => item.id === id) || null;
  }

  private saveOne<T extends {id: string}>(collection: string, item: T): void {
    const items = this.load<T>(collection);
    const index = items.findIndex(i => i.id === item.id);
    if (index >= 0) {
      items[index] = item;
    } else {
      items.push(item);
    }
    this.save(collection, items);
  }

  private deleteOne<T extends {id: string}>(
    collection: string,
    id: string
  ): void {
    const items = this.load<T>(collection);
    const filtered = items.filter(item => item.id !== id);
    this.save(collection, filtered);
  }

  async initialize(): Promise<void> {
    // localStorage doesn't need initialization
    return Promise.resolve();
  }

  // Tags
  async getTags(filter?: QueryFilter): Promise<ITagJsonApi[]> {
    let tags = this.load<ITagJsonApi>('tags');

    if (filter?.userId) {
      tags = tags.filter(
        tag => tag.relationships.user.data.id === filter.userId
      );
    }

    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      tags = tags.filter(
        tag => new Date(tag.attributes.date_updated) > sinceDate
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      tags = tags.slice(offset, offset + filter.limit);
    }

    return tags;
  }

  async getTag(id: string): Promise<ITagJsonApi | null> {
    return this.loadOne<ITagJsonApi>('tags', id);
  }

  async saveTags(tags: ITagJsonApi[]): Promise<void> {
    const existing = this.load<ITagJsonApi>('tags');
    const map = new Map(existing.map(t => [t.id, t]));

    // Merge new tags, replacing existing ones
    tags.forEach(tag => map.set(tag.id, tag));

    this.save('tags', Array.from(map.values()));
  }

  async saveTag(tag: ITagJsonApi): Promise<void> {
    this.saveOne('tags', tag);
  }

  async deleteTag(id: string): Promise<void> {
    this.deleteOne('tags', id);
  }

  // Text Entries
  async getTextEntries(filter?: QueryFilter): Promise<ITextEntryJsonApi[]> {
    let entries = this.load<ITextEntryJsonApi>('textEntries');

    if (filter?.userId) {
      entries = entries.filter(
        entry => entry.relationships.user.data.id === filter.userId
      );
    }

    if (filter?.tagId) {
      const relations = this.load<ITagTextEntryThroughModelJsonApi>(
        'tagTextEntryRelations'
      );
      const entryIds = new Set(
        relations
          .filter(r => r.relationships.tag.data.id === filter.tagId)
          .map(r => r.relationships.text_entry.data.id)
      );
      entries = entries.filter(entry => entryIds.has(entry.id));
    }

    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      entries = entries.filter(
        entry => new Date(entry.attributes.date_updated) > sinceDate
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      entries = entries.slice(offset, offset + filter.limit);
    }

    return entries;
  }

  async getTextEntry(id: string): Promise<ITextEntryJsonApi | null> {
    return this.loadOne<ITextEntryJsonApi>('textEntries', id);
  }

  async saveTextEntries(entries: ITextEntryJsonApi[]): Promise<void> {
    const existing = this.load<ITextEntryJsonApi>('textEntries');
    const map = new Map(existing.map(e => [e.id, e]));

    entries.forEach(entry => map.set(entry.id, entry));

    this.save('textEntries', Array.from(map.values()));
  }

  async saveTextEntry(entry: ITextEntryJsonApi): Promise<void> {
    this.saveOne('textEntries', entry);
  }

  async deleteTextEntry(id: string): Promise<void> {
    this.deleteOne('textEntries', id);
  }

  // Untagged Text Entries
  async getUntaggedTextEntries(
    filter?: QueryFilter
  ): Promise<ITextEntryJsonApi[]> {
    let entries = this.load<ITextEntryJsonApi>('untaggedTextEntries');

    if (filter?.userId) {
      entries = entries.filter(
        entry => entry.relationships.user.data.id === filter.userId
      );
    }

    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      entries = entries.filter(
        entry => new Date(entry.attributes.date_updated) > sinceDate
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      entries = entries.slice(offset, offset + filter.limit);
    }

    return entries;
  }

  async saveUntaggedTextEntries(entries: ITextEntryJsonApi[]): Promise<void> {
    const existing = this.load<ITextEntryJsonApi>('untaggedTextEntries');
    const map = new Map(existing.map(e => [e.id, e]));

    entries.forEach(entry => map.set(entry.id, entry));

    this.save('untaggedTextEntries', Array.from(map.values()));
  }

  async deleteUntaggedTextEntry(id: string): Promise<void> {
    this.deleteOne('untaggedTextEntries', id);
  }

  // Tag-TextEntry relationships
  async getTagTextEntryRelations(
    filter?: QueryFilter
  ): Promise<ITagTextEntryThroughModelJsonApi[]> {
    let relations = this.load<ITagTextEntryThroughModelJsonApi>(
      'tagTextEntryRelations'
    );

    if (filter?.tagId) {
      relations = relations.filter(
        r => r.relationships.tag.data.id === filter.tagId
      );
    }

    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      relations = relations.filter(
        relation => new Date(relation.attributes.date_updated) > sinceDate
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      relations = relations.slice(offset, offset + filter.limit);
    }

    return relations;
  }

  async saveTagTextEntryRelations(
    relations: ITagTextEntryThroughModelJsonApi[]
  ): Promise<void> {
    const existing = this.load<ITagTextEntryThroughModelJsonApi>(
      'tagTextEntryRelations'
    );
    const map = new Map(existing.map(r => [r.id, r]));

    relations.forEach(relation => map.set(relation.id, relation));

    this.save('tagTextEntryRelations', Array.from(map.values()));
  }

  async deleteTagTextEntryRelation(id: string): Promise<void> {
    this.deleteOne('tagTextEntryRelations', id);
  }

  // Users
  async getUsers(filter?: QueryFilter): Promise<IUserJsonApi[]> {
    let users = this.load<IUserJsonApi>('users');

    if (filter?.since) {
      const sinceDate = new Date(filter.since);
      users = users.filter(
        user => new Date(user.attributes.date_updated) > sinceDate
      );
    }

    if (filter?.limit) {
      const offset = filter.offset || 0;
      users = users.slice(offset, offset + filter.limit);
    }

    return users;
  }

  async getUser(id: string): Promise<IUserJsonApi | null> {
    return this.loadOne<IUserJsonApi>('users', id);
  }

  async saveUsers(users: IUserJsonApi[]): Promise<void> {
    const existing = this.load<IUserJsonApi>('users');
    const map = new Map(existing.map(u => [u.id, u]));

    users.forEach(user => map.set(user.id, user));

    this.save('users', Array.from(map.values()));
  }

  async saveUser(user: IUserJsonApi): Promise<void> {
    this.saveOne('users', user);
  }

  // Sync metadata
  async getSyncMetadata(): Promise<SyncMetadata | null> {
    const data = localStorage.getItem(this.getKey('syncMetadata'));
    return data ? JSON.parse(data) : null;
  }

  async saveSyncMetadata(metadata: SyncMetadata): Promise<void> {
    localStorage.setItem(this.getKey('syncMetadata'), JSON.stringify(metadata));
  }

  // Bulk operations
  async clear(): Promise<void> {
    const collections = [
      'tags',
      'textEntries',
      'untaggedTextEntries',
      'tagTextEntryRelations',
      'users',
      'syncMetadata',
    ];

    collections.forEach(collection => {
      localStorage.removeItem(this.getKey(collection));
    });
  }

  async transaction<T>(operation: () => Promise<T>): Promise<T> {
    // localStorage doesn't support transactions, just run the operation
    return await operation();
  }
}
