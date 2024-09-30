import {default as DexieDefault} from 'dexie';

import type {IEntry, IJunction, ITag, IUser} from '../types';
import {ITearleadsDB} from '../types';

class TearleadsDexie extends DexieDefault implements ITearleadsDB {
  users!: DexieDefault.Table<IUser, number>; // number is the type of the primary key
  tags!: DexieDefault.Table<ITag, number>;
  entries!: DexieDefault.Table<IEntry, number>;
  junction!: DexieDefault.Table<IJunction, number>;

  // https://dexie.org/docs/Version/Version.stores()#description
  constructor() {
    super('Tearleads');
    this.version(2).stores({
      users: 'id&, username, updated',
      tags: 'id&, userId, entryCount, updated, synced, deleted',
      entries: 'id&, userId, subject, body, updated, synced, deleted',
      junction: 'id&, [userId+tagId], updated, synced, deleted',
    });
  }

  async putUser(user: IUser): Promise<void> {
    await this.users.put(user);
  }

  async getUser(username: string) {
    return await this.users.where('username').equals(username).first();
  }

  async putTag(tag: ITag): Promise<void> {
    await this.tags.put(tag);
  }

  async putEntry(entry: IEntry): Promise<void> {
    await this.entries.put(entry);
  }

  async putJunction(junction: IJunction): Promise<void> {
    await this.junction.put(junction);
  }

  async getTagsForUserName(username: string): Promise<ITag[]> {
    let tags: ITag[] = [];
    const user = await this.users.where('username').equals(username).first();
    if (user === undefined) {
      return tags;
    }
    tags = await this.tags.where('userId').equals(user.id).toArray();
    return tags;
  }
}

export {TearleadsDexie};
