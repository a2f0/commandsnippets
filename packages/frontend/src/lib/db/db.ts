import {CommandsnippetsDexie} from './adapters/dexie';
import type {ICommandsnippetsDB, IDatabase} from './types';

export class DB implements IDatabase {
  db: ICommandsnippetsDB;
  constructor(db: ICommandsnippetsDB) {
    this.db = db;
  }
}
const dexie = new CommandsnippetsDexie();

const db = new DB(dexie).db;

export {db};
