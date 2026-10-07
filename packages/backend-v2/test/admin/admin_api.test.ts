import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {adminAuditLog, tokens, type User, users} from '../../src/db/schema';
import {changeAccountStatus} from '../../src/services/accounts';
import {getOrCreateToken} from '../../src/services/tokens';
import {
  ApiClient,
  db,
  json,
  refreshUser,
  tagFactory,
  textEntryFactory,
  tokenFor,
  userFactory,
} from '../helpers';

// v2: the admin API (/api/v1/admin), for is_staff users.
async function staffClient(): Promise<{staff: User; client: ApiClient}> {
  const staff = await userFactory(
    {username: 'staff', email: 'staff@example.com'},
    {examples: false}
  );
  await db().update(users).set({is_staff: true}).where(eq(users.id, staff.id));
  return {
    staff: (await refreshUser(staff.id)) as User,
    client: new ApiClient(await tokenFor(staff.id)),
  };
}

const userPatch = (id: number, attributes: Record<string, unknown>) => ({
  data: {type: 'AdminUser', id: String(id), attributes},
});

const auditRows = () =>
  db().select().from(adminAuditLog).orderBy(adminAuditLog.id);

describe('AdminApi access', () => {
  const routes = [
    ['GET', '/api/v1/admin/users'],
    ['GET', '/api/v1/admin/users/1'],
    ['PATCH', '/api/v1/admin/users/1'],
    ['GET', '/api/v1/admin/audit_log'],
    ['GET', '/api/v1/admin/users/1/tags'],
    ['GET', '/api/v1/admin/users/1/entries'],
    ['GET', '/api/v1/admin/users/1/tags_entries'],
  ] as const;

  const call = (client: ApiClient, method: string, path: string) =>
    method === 'PATCH'
      ? client.patch(path, userPatch(1, {is_active: false}))
      : client.get(path);

  it('refuses anonymous requests', async () => {
    for (const [method, path] of routes) {
      const response = await call(new ApiClient(), method, path);
      expect(response.status).toBe(403);
      expect((await json(response)).errors[0].code).toBe('not_authenticated');
    }
  });

  it('refuses users who are not staff', async () => {
    const user = await userFactory();
    const client = new ApiClient(await tokenFor(user.id));
    for (const [method, path] of routes) {
      const response = await call(client, method, path);
      expect(response.status).toBe(403);
      expect((await json(response)).errors[0].code).toBe('permission_denied');
    }
    expect((await refreshUser(user.id))?.is_active).toBe(true);
    expect(await auditRows()).toEqual([]);
  });

  it('refuses a deactivated staff account', async () => {
    const {staff, client} = await staffClient();
    await db()
      .update(users)
      .set({is_active: false})
      .where(eq(users.id, staff.id));
    const response = await client.get('/api/v1/admin/users');
    expect(response.status).toBe(403);
    expect((await json(response)).errors[0].code).toBe('not_authenticated');
  });
});

describe('AdminApi users', () => {
  let staff: User;
  let client: ApiClient;

  beforeEach(async () => {
    ({staff, client} = await staffClient());
  });

  it('lists every user with account details and live counts', async () => {
    const alice = await userFactory(
      {username: 'alice', email: 'alice@example.com'},
      {examples: false}
    );
    await textEntryFactory({user: alice});
    await textEntryFactory({user: alice, is_deleted: true});
    await tagFactory({user: alice});
    await tagFactory({user: alice, is_deleted: true});

    const response = await client.get('/api/v1/admin/users');
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'application/vnd.api+json'
    );
    const body = await json(response);
    expect(body.meta.pagination).toEqual({page: 1, pages: 1, count: 2});
    expect(body.data.map((user: {id: string}) => user.id)).toEqual([
      String(staff.id),
      String(alice.id),
    ]);
    const row = body.data[1];
    expect(row.type).toBe('AdminUser');
    expect(row.attributes).toEqual({
      username: 'alice',
      email: 'alice@example.com',
      is_staff: false,
      is_active: true,
      date_joined: expect.any(String),
      last_login: expect.any(String),
      last_active: expect.any(String),
      login_count: 1,
      date_updated: expect.any(String),
      date_marked_for_deletion: null,
      entry_count: 1,
      tag_count: 1,
      data_version: 1,
    });
    expect(body.data[0].attributes.is_staff).toBe(true);
  });

  it('filters by is_active and is_staff, and rejects bad values', async () => {
    const bob = await userFactory({username: 'bob'}, {examples: false});
    await db()
      .update(users)
      .set({is_active: false})
      .where(eq(users.id, bob.id));

    const ids = async (query: string) =>
      (await json(await client.get(`/api/v1/admin/users?${query}`))).data.map(
        (user: {id: string}) => user.id
      );
    expect(await ids('filter[is_active]=false')).toEqual([String(bob.id)]);
    expect(await ids('filter[is_active]=true')).toEqual([String(staff.id)]);
    expect(await ids('filter[is_staff]=true')).toEqual([String(staff.id)]);

    const bad = await client.get('/api/v1/admin/users?filter[is_active]=maybe');
    expect(bad.status).toBe(400);
    const unknown = await client.get('/api/v1/admin/users?filter[password]=x');
    expect(unknown.status).toBe(400);
  });

  it('searches usernames and emails, case-insensitively and literally', async () => {
    const carol = await userFactory(
      {username: 'Carol_1', email: 'carol@corp.example'},
      {examples: false}
    );
    await userFactory({username: 'carolX1'}, {examples: false});

    const ids = async (term: string) =>
      (
        await json(
          await client.get(
            `/api/v1/admin/users?filter[search]=${encodeURIComponent(term)}`
          )
        )
      ).data.map((user: {id: string}) => user.id);
    expect(await ids('CORP.EXAMPLE')).toEqual([String(carol.id)]);
    // `_` and `%` match themselves, not any character.
    expect(await ids('carol_')).toEqual([String(carol.id)]);
    expect(await ids('%')).toEqual([]);
    expect((await ids('')).length).toBe(3);
  });

  it('sorts by the allowed fields and pages', async () => {
    const dave = await userFactory({username: 'dave'}, {examples: false});
    await textEntryFactory({user: dave});
    await textEntryFactory({user: dave});

    const first = async (query: string) =>
      (await json(await client.get(`/api/v1/admin/users?${query}`))).data[0]
        .attributes.username;
    expect(await first('sort=-entry_count')).toBe('dave');
    expect(await first('sort=username')).toBe('dave');
    expect(await first('sort=-username')).toBe('staff');
    // Each of staff's requests makes them the most recently active.
    expect(await first('sort=-last_active')).toBe('staff');
    expect(await first('sort=last_active')).toBe('dave');

    const paged = await json(
      await client.get('/api/v1/admin/users?page[size]=1&page[number]=2')
    );
    expect(paged.data.length).toBe(1);
    expect(paged.meta.pagination).toEqual({page: 2, pages: 2, count: 2});

    expect((await client.get('/api/v1/admin/users?sort=password')).status).toBe(
      400
    );
    expect((await client.get('/api/v1/admin/users?include=user')).status).toBe(
      400
    );
  });

  it('retrieves one user, 404ing for missing or malformed ids', async () => {
    const response = await client.get(`/api/v1/admin/users/${staff.id}`);
    expect(response.status).toBe(200);
    expect((await json(response)).data.attributes.username).toBe('staff');
    expect((await client.get('/api/v1/admin/users/999999')).status).toBe(404);
    expect((await client.get('/api/v1/admin/users/abc')).status).toBe(404);
  });
});

describe('AdminApi deactivation', () => {
  let staff: User;
  let client: ApiClient;
  let target: User;

  beforeEach(async () => {
    ({staff, client} = await staffClient());
    target = await userFactory({username: 'target'}, {examples: false});
  });

  it('deactivates an account, ends its sessions and records it', async () => {
    const targetClient = new ApiClient(await tokenFor(target.id));
    expect((await targetClient.get('/api/v1/user/')).status).toBe(200);

    const response = await client.patch(
      `/api/v1/admin/users/${target.id}`,
      userPatch(target.id, {is_active: false})
    );

    expect(response.status).toBe(200);
    expect((await json(response)).data.attributes.is_active).toBe(false);
    const after = await refreshUser(target.id);
    expect(after?.is_active).toBe(false);
    expect(after?.date_updated).not.toBe(target.date_updated);
    expect(
      await db().select().from(tokens).where(eq(tokens.user_id, target.id))
    ).toEqual([]);
    expect((await targetClient.get('/api/v1/user/')).status).toBe(401);
    expect(await auditRows()).toEqual([
      {
        id: expect.any(Number),
        created: expect.any(String),
        action: 'deactivate_user',
        actor_id: staff.id,
        actor_username: 'staff',
        target_user_id: target.id,
        target_username: 'target',
      },
    ]);
  });

  it('reactivates an account and records it', async () => {
    const path = `/api/v1/admin/users/${target.id}`;
    await client.patch(path, userPatch(target.id, {is_active: false}));
    const response = await client.patch(
      path,
      userPatch(target.id, {is_active: true})
    );
    expect(response.status).toBe(200);
    expect((await refreshUser(target.id))?.is_active).toBe(true);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'deactivate_user',
      'activate_user',
    ]);
  });

  it('records nothing when the status does not change', async () => {
    const tokenBefore = await tokenFor(target.id);
    const response = await client.patch(
      `/api/v1/admin/users/${target.id}`,
      userPatch(target.id, {is_active: true})
    );
    expect(response.status).toBe(200);
    expect(await auditRows()).toEqual([]);
    expect(await tokenFor(target.id)).toBe(tokenBefore);
    const empty = await client.patch(
      `/api/v1/admin/users/${target.id}`,
      userPatch(target.id, {})
    );
    expect(empty.status).toBe(200);
    expect(await auditRows()).toEqual([]);
  });

  it('will not let staff deactivate themselves', async () => {
    const response = await client.patch(
      `/api/v1/admin/users/${staff.id}`,
      userPatch(staff.id, {is_active: false})
    );
    expect(response.status).toBe(400);
    const error = (await json(response)).errors[0];
    expect(error.detail).toBe('You cannot deactivate your own account.');
    expect(error.source.pointer).toBe('/data/attributes/is_active');
    expect((await refreshUser(staff.id))?.is_active).toBe(true);
  });

  it('rejects changes to anything but is_active and marked_for_deletion', async () => {
    for (const attributes of [
      {is_staff: true},
      {username: 'renamed'},
      {is_active: false, email: 'x@example.com'},
    ]) {
      const response = await client.patch(
        `/api/v1/admin/users/${target.id}`,
        userPatch(target.id, attributes)
      );
      expect(response.status).toBe(400);
      expect((await json(response)).errors[0].code).toBe('read_only');
    }
    const after = await refreshUser(target.id);
    expect([after?.is_staff, after?.is_active, after?.username]).toEqual([
      false,
      true,
      'target',
    ]);
    expect(await auditRows()).toEqual([]);
  });

  it('validates the document and the value', async () => {
    const path = `/api/v1/admin/users/${target.id}`;
    const invalid = await client.patch(
      path,
      userPatch(target.id, {is_active: 'sometimes'})
    );
    expect(invalid.status).toBe(400);
    const wrongType = await client.patch(path, {
      data: {
        type: 'User',
        id: String(target.id),
        attributes: {is_active: false},
      },
    });
    expect(wrongType.status).toBe(409);
    const wrongId = await client.patch(
      path,
      userPatch(staff.id, {is_active: false})
    );
    expect(wrongId.status).toBe(409);
    expect(
      (
        await client.patch(
          '/api/v1/admin/users/999999',
          userPatch(999999, {is_active: false})
        )
      ).status
    ).toBe(404);
    expect((await refreshUser(target.id))?.is_active).toBe(true);
  });
});

describe('AdminApi marking for deletion', () => {
  let staff: User;
  let client: ApiClient;
  let target: User;
  let path: string;

  const patch = (attributes: Record<string, unknown>) =>
    client.patch(path, userPatch(target.id, attributes));
  const targetTokens = () =>
    db().select().from(tokens).where(eq(tokens.user_id, target.id));
  const getTarget = async () => {
    const user = await refreshUser(target.id);
    if (user === undefined) {
      throw new Error('target is gone');
    }
    return user;
  };

  beforeEach(async () => {
    ({staff, client} = await staffClient());
    target = await userFactory({username: 'target'}, {examples: false});
    path = `/api/v1/admin/users/${target.id}`;
  });

  it('marks an account, deactivating it, ending its sessions and recording it', async () => {
    const targetClient = new ApiClient(await tokenFor(target.id));
    expect((await targetClient.get('/api/v1/user/')).status).toBe(200);

    const response = await patch({marked_for_deletion: true});

    expect(response.status).toBe(200);
    const {attributes} = (await json(response)).data;
    expect(attributes.is_active).toBe(false);
    expect(attributes.date_marked_for_deletion).toEqual(expect.any(String));
    const after = await refreshUser(target.id);
    expect(after?.is_active).toBe(false);
    expect(after?.date_marked_for_deletion).not.toBeNull();
    expect(after?.date_updated).not.toBe(target.date_updated);
    expect(await targetTokens()).toEqual([]);
    expect((await targetClient.get('/api/v1/user/')).status).toBe(401);
    // Marking implies the deactivation; only the mark is recorded.
    expect(await auditRows()).toEqual([
      {
        id: expect.any(Number),
        created: expect.any(String),
        action: 'mark_user_for_deletion',
        actor_id: staff.id,
        actor_username: 'staff',
        target_user_id: target.id,
        target_username: 'target',
      },
    ]);
  });

  it('ends the sessions of an account deactivated before it was marked', async () => {
    await db()
      .update(users)
      .set({is_active: false})
      .where(eq(users.id, target.id));
    await tokenFor(target.id);

    expect((await patch({marked_for_deletion: true})).status).toBe(200);

    expect(await targetTokens()).toEqual([]);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'mark_user_for_deletion',
    ]);
  });

  it('lists marked accounts as deactivated', async () => {
    await patch({marked_for_deletion: true});

    const body = await json(
      await client.get('/api/v1/admin/users?filter[is_active]=false')
    );
    expect(body.data.map((user: {id: string}) => user.id)).toEqual([
      String(target.id),
    ]);
    expect(body.data[0].attributes.date_marked_for_deletion).toEqual(
      expect.any(String)
    );
  });

  it('unmarks an account, which stays deactivated until reactivated', async () => {
    await patch({marked_for_deletion: true});

    const response = await patch({marked_for_deletion: false});

    expect(response.status).toBe(200);
    const {attributes} = (await json(response)).data;
    expect(attributes.date_marked_for_deletion).toBeNull();
    expect(attributes.is_active).toBe(false);
    expect((await patch({is_active: true})).status).toBe(200);
    expect((await refreshUser(target.id))?.is_active).toBe(true);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'mark_user_for_deletion',
      'unmark_user_for_deletion',
      'activate_user',
    ]);
  });

  it('unmarks and reactivates in one request', async () => {
    await patch({marked_for_deletion: true});

    const response = await patch({
      marked_for_deletion: false,
      is_active: true,
    });

    expect(response.status).toBe(200);
    const after = await refreshUser(target.id);
    expect([after?.is_active, after?.date_marked_for_deletion]).toEqual([
      true,
      null,
    ]);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'mark_user_for_deletion',
      'unmark_user_for_deletion',
      'activate_user',
    ]);
  });

  it('will not reactivate an account that is marked', async () => {
    await patch({marked_for_deletion: true});

    for (const attributes of [
      {is_active: true},
      {is_active: true, marked_for_deletion: true},
    ]) {
      const response = await patch(attributes);
      expect(response.status).toBe(400);
      const error = (await json(response)).errors[0];
      expect(error.detail).toBe(
        'An account marked for deletion cannot be reactivated.'
      );
      expect(error.source.pointer).toBe('/data/attributes/is_active');
    }
    expect((await refreshUser(target.id))?.is_active).toBe(false);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'mark_user_for_deletion',
    ]);
  });

  it('records nothing, and keeps the date, when the mark does not change', async () => {
    await patch({marked_for_deletion: true});
    const marked = (await refreshUser(target.id))?.date_marked_for_deletion;

    for (const attributes of [
      {marked_for_deletion: true},
      {is_active: false},
      {},
    ]) {
      expect((await patch(attributes)).status).toBe(200);
    }
    expect((await refreshUser(target.id))?.date_marked_for_deletion).toBe(
      marked
    );
    expect((await auditRows()).map(row => row.action)).toEqual([
      'mark_user_for_deletion',
    ]);

    const other = await userFactory({username: 'other'}, {examples: false});
    const tokenBefore = await tokenFor(other.id);
    const unmarked = await client.patch(
      `/api/v1/admin/users/${other.id}`,
      userPatch(other.id, {marked_for_deletion: false})
    );
    expect(unmarked.status).toBe(200);
    expect(await tokenFor(other.id)).toBe(tokenBefore);
    expect((await auditRows()).length).toBe(1);
  });

  it('never overwrites a mark that raced a reactivation', async () => {
    await patch({is_active: false});
    // The reactivation read the account before the mark landed.
    const stale = await getTarget();
    await patch({marked_for_deletion: true});

    expect(
      await changeAccountStatus(db(), staff, stale, {
        active: true,
        marked: false,
      })
    ).toBe(false);

    const after = await refreshUser(target.id);
    expect(after?.is_active).toBe(false);
    expect(after?.date_marked_for_deletion).not.toBeNull();
    expect((await auditRows()).map(row => row.action)).toEqual([
      'deactivate_user',
      'mark_user_for_deletion',
    ]);
  });

  it('never applies a change read before a mark that was since undone', async () => {
    await patch({is_active: false});
    const stale = await getTarget();
    // Marked and unmarked since: back to deactivated and unmarked.
    await patch({marked_for_deletion: true});
    await patch({marked_for_deletion: false});

    expect(
      await changeAccountStatus(db(), staff, stale, {
        active: true,
        marked: false,
      })
    ).toBe(false);

    expect((await refreshUser(target.id))?.is_active).toBe(false);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'deactivate_user',
      'mark_user_for_deletion',
      'unmark_user_for_deletion',
    ]);
  });

  it('advances date_updated past a revision ahead of this clock', async () => {
    // Written by a Worker whose clock runs ahead of this one's.
    const ahead = '2999-01-01T00:00:00.000000';
    await db()
      .update(users)
      .set({date_updated: ahead})
      .where(eq(users.id, target.id));

    await patch({marked_for_deletion: true});
    const marked = (await getTarget()).date_updated;
    await patch({marked_for_deletion: false});
    const unmarked = (await getTarget()).date_updated;

    expect(marked > ahead).toBe(true);
    expect(unmarked > marked).toBe(true);
  });

  it('changes nothing, sessions included, once the account has changed', async () => {
    await patch({is_active: false});
    // The mark read the account before it was reactivated and signed in to.
    const stale = await getTarget();
    await patch({is_active: true});
    const token = await getOrCreateToken(db(), target.id);

    expect(
      await changeAccountStatus(db(), staff, stale, {
        active: false,
        marked: true,
      })
    ).toBe(false);

    const after = await refreshUser(target.id);
    expect([after?.is_active, after?.date_marked_for_deletion]).toEqual([
      true,
      null,
    ]);
    expect(await targetTokens()).toEqual([
      expect.objectContaining({key: token}),
    ]);
    expect((await auditRows()).map(row => row.action)).toEqual([
      'deactivate_user',
      'activate_user',
    ]);
  });

  it('will not let staff mark themselves', async () => {
    const response = await client.patch(
      `/api/v1/admin/users/${staff.id}`,
      userPatch(staff.id, {marked_for_deletion: true})
    );
    expect(response.status).toBe(400);
    const error = (await json(response)).errors[0];
    expect(error.detail).toBe('You cannot mark your own account for deletion.');
    expect(error.source.pointer).toBe('/data/attributes/marked_for_deletion');
    const after = await refreshUser(staff.id);
    expect([after?.is_active, after?.date_marked_for_deletion]).toEqual([
      true,
      null,
    ]);
    expect(await auditRows()).toEqual([]);
  });

  it('validates the value', async () => {
    const response = await patch({marked_for_deletion: 'sometimes'});
    expect(response.status).toBe(400);
    expect((await refreshUser(target.id))?.date_marked_for_deletion).toBeNull();
  });
});

describe('AdminApi audit log', () => {
  let client: ApiClient;

  beforeEach(async () => {
    ({client} = await staffClient());
  });

  it('lists changes newest first and filters by target', async () => {
    const one = await userFactory({username: 'one'}, {examples: false});
    const two = await userFactory({username: 'two'}, {examples: false});
    for (const user of [one, two]) {
      await client.patch(
        `/api/v1/admin/users/${user.id}`,
        userPatch(user.id, {is_active: false})
      );
    }

    const response = await client.get('/api/v1/admin/audit_log');
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(
      body.data.map(
        (entry: {attributes: {target_username: string}}) =>
          entry.attributes.target_username
      )
    ).toEqual(['two', 'one']);
    expect(body.data[0]).toEqual({
      type: 'AdminAuditLogEntry',
      id: expect.any(String),
      attributes: {
        created: expect.any(String),
        action: 'deactivate_user',
        actor_id: expect.any(String),
        actor_username: 'staff',
        target_user_id: String(two.id),
        target_username: 'two',
      },
    });

    const filtered = await json(
      await client.get(
        `/api/v1/admin/audit_log?filter[target_user_id]=${one.id}`
      )
    );
    expect(filtered.data.length).toBe(1);
    expect(filtered.data[0].attributes.target_username).toBe('one');

    for (const query of [
      'filter[target_user_id]=abc',
      'filter[search]=one',
      'sort=created',
      'include=actor',
    ]) {
      expect(
        (await client.get(`/api/v1/admin/audit_log?${query}`)).status
      ).toBe(400);
    }
  });

  it('keeps entries after the target user is deleted', async () => {
    const gone = await userFactory({username: 'gone'}, {examples: false});
    await client.patch(
      `/api/v1/admin/users/${gone.id}`,
      userPatch(gone.id, {is_active: false})
    );
    await db().delete(users).where(eq(users.id, gone.id));

    const [entry] = (await json(await client.get('/api/v1/admin/audit_log')))
      .data;
    expect(entry.attributes.target_user_id).toBeNull();
    expect(entry.attributes.target_username).toBe('gone');
  });
});
