import {TearleadsDexie} from './adapters/dexie';
import type {IDatabase, ITearleadsDB} from './types';

export class DB implements IDatabase {
  db: ITearleadsDB;
  constructor(db: ITearleadsDB) {
    this.db = db;
  }
}
const dexie = new TearleadsDexie();

const db = new DB(dexie).db;

export {db};
