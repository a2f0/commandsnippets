import {describe, expect, it} from 'vitest';
import {users} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {getOrCreateUser} from '../../src/services/users';
import {db} from '../helpers';

// Accounts may have no email (''), and the unique email index leaves them
// out: a login is keyed on an email, so one without any is no account's.
describe('getOrCreateUser with an empty email', () => {
  it('never answers with an account that has no email', async () => {
    const timestamp = now();
    const [emailless] = await db()
      .insert(users)
      .values({
        username: 'emailless',
        email: '',
        date_joined: timestamp,
        date_updated: timestamp,
      })
      .returning();

    const {user, created} = await getOrCreateUser(db(), 'someone', '');
    expect(created).toBe(true);
    expect(user.id).not.toBe(emailless?.id);
    expect(user.username).toBe('someone');
    expect(user.email).toBe('');
  });

  it('still finds the account of a non-empty email', async () => {
    const first = await getOrCreateUser(db(), 'someone', 'a@example.com');
    expect(first.created).toBe(true);
    const again = await getOrCreateUser(db(), 'other', 'a@example.com');
    expect(again.created).toBe(false);
    expect(again.user.id).toBe(first.user.id);
  });
});
