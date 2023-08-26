import Dexie from 'dexie';

interface IUser {
  id?: string;
  username: string;
  updated: number;
}

interface ITag {
  id?: string;
  name: string;
  updated: number;
}

interface IEntry {
  id?: string;
  subject: string;
  body: string;
  updated: number;
}

interface IJunction {
  id?: string;
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
      tags: 'id&, name, updated',
      entries: 'id&, subject, body, updated',
      junction: 'id&, [userId+tagId], updated',
    });
  }
}

export {TearleadsDexie};
