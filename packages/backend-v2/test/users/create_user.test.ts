import {describe, expect, it, vi} from 'vitest';
import {users} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {createUser} from '../../src/services/users';
import {db} from '../helpers';

describe('createUser', () => {
  it('gives up after 20 colliding username suffixes', async () => {
    // With a zeroed RNG the candidates are u, u-0, u-00, ... u-000...0 (20).
    vi.spyOn(crypto, 'getRandomValues').mockImplementation(array => array);
    const timestamp = now();
    const taken = [
      'u',
      ...Array.from({length: 20}, (_, i) => `u-${'0'.repeat(i + 1)}`),
    ];
    // One row per statement: D1 allows at most 100 bound parameters.
    for (const username of taken) {
      await db()
        .insert(users)
        .values({
          username,
          email: `${username}@example.com`,
          date_joined: timestamp,
          date_updated: timestamp,
        });
    }
    await expect(createUser(db(), 'u', 'new@example.com')).rejects.toThrow(
      'Could not find a free username for u'
    );
  });
});
