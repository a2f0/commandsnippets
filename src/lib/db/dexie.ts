import Dexie from 'dexie';

interface IUser {
  id: string;
  username: string;
  updated: number;
}

interface ITag {
  id: string;
  name: string;
  userId: string;
  updated: number;
}

interface IEntry {
  id: string;
  subject: string;
  body: string;
  updated: number;
}

interface IJunction {
  id: string;
  entryId: string;
  tagId: string;
  userId: string;
  updated: number;
  order: number;
}

class TearleadsDexie extends Dexie {
  users!: Dexie.Table<IUser, number>; // number is the type of the primary key
  tags!: Dexie.Table<ITag, number>;
  entries!: Dexie.Table<IEntry, number>;
  junction!: Dexie.Table<IJunction, number>;

  constructor() {
    super('Tearleads');
    this.version(1).stores({
      users: 'id&, username, updated',
      tags: 'id&, userId, name, updated',
      entries: 'id&, subject, body, updated',
      junction: 'id&, [userId+tagId], updated',
    });
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
