import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {tagsEntries} from '../../src/db/schema';
import {createUser} from '../../src/services/users';
import {
  db,
  entriesOf,
  isoformat,
  tagsOf,
  tokenFor,
  userFactory,
} from '../helpers';

// tearleads/users/tests/test_user_model.py
//
// Several Django tests wrapped creation in `try/except IntegrityError: pass`
// and so asserted nothing. The ports below assert what v2 (and Django)
// actually do.
describe('TestUserModel', () => {
  it('test_usernames_cannot_be_duplicated', async () => {
    const user1 = await userFactory({username: 'collide'});
    const user2 = await userFactory({username: 'collide'});
    expect(user1.username).toBe('collide');
    expect(user2.username).not.toBe('collide');
    const user3 = await userFactory({username: user2.username});
    expect(user3.username).not.toBe(user2.username);
  });

  it('test_usernames_cannot_be_none', async () => {
    await expect(
      createUser(db(), null as unknown as string, 'none@example.com')
    ).rejects.toThrow();
  });

  it('test_usernames_cannot_be_empty_strings', async () => {
    // Django accepted an empty username at the model layer; so does v2.
    const user = await userFactory({username: ''});
    expect(user.username).toBe('');
  });

  it('test_emails_cannot_be_duplicates', async () => {
    // Django's version wrapped this in try/except and asserted nothing; v2
    // enforces what the name says (logins find accounts by email).
    await userFactory({email: 'collide@commandsnippets.com'});
    await expect(
      userFactory({email: 'collide@commandsnippets.com'})
    ).rejects.toThrow('UNIQUE constraint failed: users_user.email');
  });

  it('allows any number of users without an email', async () => {
    const first = await userFactory({email: ''});
    const second = await userFactory({email: ''});
    expect(second.id).not.toBe(first.id);
  });

  it('test_emails_cannot_be_none', async () => {
    await expect(
      createUser(db(), 'no-email', null as unknown as string)
    ).rejects.toThrow();
  });

  it('test_emails_cannot_be_empty_strings', async () => {
    const user = await userFactory({email: ''});
    expect(user.email).toBe('');
  });

  it('test_date_updated_initialized_for_new_user', async () => {
    const user = await userFactory();
    expect(user.date_updated).not.toBeNull();
  });
});

// v2: what Django's User.save() and post_save signal did on creation, minus
// the example tags and entries: new accounts start empty.
describe('UserCreationDefaults', () => {
  it('creates a token and no tags, entries or junctions', async () => {
    const user = await createUser(db(), 'new-user', 'new-user@example.com');
    expect(await tokenFor(user.id)).toMatch(/^[0-9a-f]{40}$/);
    expect(user.last_login).toBe(user.date_joined);
    expect(user.login_count).toBe(1);

    expect(await tagsOf(user)).toEqual([]);
    expect(await entriesOf(user)).toEqual([]);
    const junctions = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.user_id, user.id));
    expect(junctions).toEqual([]);
  });

  it('gives the user row increasing timestamps', async () => {
    const user = await createUser(db(), 'timestamps', 'timestamps@example.com');
    expect(user.date_joined < user.date_updated).toBe(true);
    expect(isoformat(user.date_updated)).toMatch(
      /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{6})?$/
    );
  });

  it('suffixes with growing random digits until the username is free', async () => {
    const base = await userFactory({username: 'taken'});
    const next = await userFactory({username: 'taken'});
    expect(base.username).toBe('taken');
    expect(next.username).toMatch(/^taken-\d$/);
  });
});
