import type {IEntry, IJunction, ITag, IUser} from './dexie';
import {TearleadsDexie} from './dexie';

export interface ITearleadsDB {
  getTagsForUserName: (username: string) => Promise<ITag[]>;
  putUser: (user: IUser) => Promise<void>;
  putTag: (tag: ITag) => Promise<void>;
  putEntry: (entry: IEntry) => Promise<void>;
  putJunction: (junction: IJunction) => Promise<void>;
}

class DB {
  db: ITearleadsDB;
  constructor(db: ITearleadsDB) {
    this.db = db;
  }
}

const dexie = new TearleadsDexie();
const db = new DB(dexie).db;

export {db};
