import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {app} from '../../src/app';
import {users} from '../../src/db/schema';
import {createUser} from '../../src/services/users';
import {
  googlePayload,
  googleRoutes,
  mockFetch,
  setCookies,
} from '../authentication/support';
import {db, raceBeforeStatement, tokenFor} from '../helpers';

describe('concurrent first logins', () => {
  it('two first logins for one email end up with one account', async () => {
    const email = 'google_user@example.com';
    let competitor = 0;
    // Another first login creates the account after this one looked it up,
    // just before this one's INSERT runs.
    const bindings = raceBeforeStatement(
      /^\s*insert into "users_user"/i,
      async () => {
        competitor = (await createUser(db(), 'google_user', email)).id;
      }
    );
    mockFetch(googleRoutes(email));
    const response = await app.request(
      'http://localhost/api/v1/google-login/',
      {
        method: 'POST',
        headers: {'Content-Type': 'application/vnd.api+json'},
        body: JSON.stringify(googlePayload()),
      },
      bindings
    );
    expect(response.status).toBe(200);

    const accounts = await db()
      .select()
      .from(users)
      .where(eq(users.email, email));
    expect(accounts.map(account => account.id)).toEqual([competitor]);
    // This login was the account's second.
    expect(accounts[0]?.login_count).toBe(2);
    expect(setCookies(response)['Authorization']?.value).toBe(
      await tokenFor(competitor)
    );
  });
});
