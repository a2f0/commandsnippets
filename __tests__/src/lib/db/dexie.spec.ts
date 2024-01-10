import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import {TearleadsDexie} from '../../../../src/lib/db/dexie';

describe('TearleadsDexie', () => {
  describe('Models', () => {
    describe('User', () => {
      it('Inserts and retrieves a User', async () => {
        const db = new TearleadsDexie();
        await db.users.put({
          id: '1',
          username: 'u1',
          updated: 1,
        });
        const user = await db.users.where('username').equals('u1').first();
        expect(user).toBeDefined();
      });
      it('Returns undefined when a user cannot be found', async () => {
        const db = new TearleadsDexie();
        const user = await db.users.where('username').equals('u2').first();
        expect(user).toBeUndefined();
      });
    });
    describe('Tag', () => {
      it('Inserts and retrieves a tag for a user', async () => {
        const db = new TearleadsDexie();
        await db.tags.put({
          id: '1',
          updated: 1,
          userId: '1',
          name: 't1',
          entryCount: 0,
          synced: false,
        });
      });
      it('Inserts a tag without a userid', async () => {
        const db = new TearleadsDexie();
        await db.tags.put({
          id: '1',
          updated: 1,
          userId: undefined,
          name: 't1',
          entryCount: 0,
        });
      });
    });
    describe('Static Methods', () => {
      it('implements getTagsForUserName', async () => {
        const db = new TearleadsDexie();
        await db.users.put({
          id: '1',
          username: 'u1',
          updated: 1,
        });
        await db.tags.put({
          id: '1',
          updated: 1,
          userId: '1',
          name: 't1',
          entryCount: 0,
          synced: false,
        });
        const tags = await db.getTagsForUserName('u1');
        expect(tags.length).toEqual(1);
      });
    });
  });
});
