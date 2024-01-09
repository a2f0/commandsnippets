import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import {db} from '../../../../src/lib/db/db';

describe('TearleadsDexie', () => {
  describe('Models', () => {
    describe('User', () => {
      it('Inserts and retrieves a User', async () => {
        await db.putUser({
          id: '1',
          username: 'u1',
          updated: 1,
        });
        const user = await db.getUser('u1');
        expect(user).toBeDefined();
      });
      it('Returns undefined when a user cannot be found', async () => {
        const user = await db.getUser('username');
        expect(user).toBeUndefined();
      });
    });
    describe('Tag', () => {
      it('Inserts and retrieves a tag for a user', async () => {
        await db.putTag({
          id: '1',
          updated: 1,
          userId: '1',
          name: 't1',
          entryCount: 0,
        });
      });
    });
    describe('Static Methods', () => {
      it('implements getTagsForUserName', async () => {
        await db.putUser({
          id: '1',
          username: 'u1',
          updated: 1,
        });
        await db.putTag({
          id: '1',
          updated: 1,
          userId: '1',
          name: 't1',
          entryCount: 0,
        });
        const tags = await db.getTagsForUserName('u1');
        expect(tags.length).toEqual(1);
      });
    });
  });
});
