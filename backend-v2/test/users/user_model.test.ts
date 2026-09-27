import {describe, expect, it} from 'vitest';
import {createUser} from '../../src/services/users';
import {
  db,
  entriesOf,
  isoformat,
  junctionsOf,
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
    // Email is not unique in Django's AbstractUser either; OAuth logins
    // resolve users by email (first match).
    const first = await userFactory({email: 'collide@commandsnippets.com'});
    const second = await userFactory({email: 'collide@commandsnippets.com'});
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

// v2: what Django's User.save() and post_save signal did on creation.
describe('UserCreationDefaults', () => {
  it('creates a token and the example tags, entries and junctions', async () => {
    const user = await userFactory();
    expect(await tokenFor(user.id)).toMatch(/^[0-9a-f]{40}$/);
    expect(user.last_login).toBe(user.date_joined);
    expect(user.login_count).toBe(1);

    const [tag1, tag2] = await tagsOf(user);
    expect([tag1?.name, tag1?.order, tag1?.entry_count]).toEqual([
      'example-postgres',
      1,
      2,
    ]);
    expect([tag2?.name, tag2?.order, tag2?.entry_count]).toEqual([
      'example-tag-2',
      2,
      1,
    ]);

    const [entry1, entry2] = await entriesOf(user);
    expect(entry1?.subject).toBe(
      'close all postgres connections other than the current one'
    );
    expect(entry1?.body).toContain('pg_terminate_backend');
    expect(entry1?.tag_count).toBe(1);
    expect(entry2?.subject).toBe(
      'show where a postgres session is originating from'
    );
    expect(entry2?.tag_count).toBe(2);

    const junctions1 = await junctionsOf(entry1 as never);
    const junctions2 = await junctionsOf(entry2 as never);
    expect(junctions1.map(j => [j.tag_id, j.order])).toEqual([[tag1?.id, 1]]);
    expect(junctions2.map(j => [j.tag_id, j.order])).toEqual([
      [tag1?.id, 2],
      [tag2?.id, 3],
    ]);
    // date_last_used tracks the tag's most recent junction.
    expect(tag1?.date_last_used).toBe(junctions2[0]?.date_created);
    expect(tag2?.date_last_used).toBe(junctions2[1]?.date_created);
  });

  it('gives each row a distinct, increasing timestamp', async () => {
    const user = await userFactory();
    const [tag1, tag2] = await tagsOf(user);
    expect(user.date_joined < user.date_updated).toBe(true);
    expect((tag1?.date_created ?? '') < (tag2?.date_created ?? '')).toBe(true);
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
