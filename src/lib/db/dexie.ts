import type {IEntry, IJunction, ITag, IUser} from './types';
import Dexie from 'dexie';
import {ITearleadsDB} from './db';

class TearleadsDexie extends Dexie implements ITearleadsDB {
  users!: Dexie.Table<IUser, number>; // number is the type of the primary key
  tags!: Dexie.Table<ITag, number>;
  entries!: Dexie.Table<IEntry, number>;
  junction!: Dexie.Table<IJunction, number>;

  constructor() {
    super('Tearleads');
    this.version(1).stores({
      users: 'id&, username, updated',
      tags: 'id&, userId, name, entryCount, updated',
      entries: 'id&, subject, body, updated',
      junction: 'id&, [userId+tagId], updated',
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
