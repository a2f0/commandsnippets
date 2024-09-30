import '@testing-library/jest-dom';
import 'fake-indexeddb/auto';
import {TearleadsTurso} from '../../../../../src/lib/db/adapters/turso';

describe('TearleadsDexie', () => {
  describe('Models', () => {
    describe('User', () => {
      it('returns undefined', async () => {
        const db = new TearleadsTurso();
        const user = await db.getUser('someUser');
        expect(user).toBeUndefined();
      });
    });
  });
});
