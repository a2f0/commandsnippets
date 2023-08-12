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

class TearleadsDexie extends Dexie {
  users!: Dexie.Table<IUser, number>; // number is the type of the primary key
  tags!: Dexie.Table<ITag, number>;

  constructor() {
    super('Tearleads');
    this.version(3).stores({
      users: 'id&, username, updated',
      tags: 'id&, name, updated',
    });
  }
}

export {TearleadsDexie};
