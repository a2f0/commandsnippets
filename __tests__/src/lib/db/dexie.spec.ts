import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import {TearleadsDexie} from '../../../../src/lib/db/dexie';

describe('Dexie', () => {
  it('Inserts a User', async () => {
    const db = new TearleadsDexie();
    await db.users.put({
      id: '1',
      username: 'u1',
      updated: 1,
    });
  });
});
