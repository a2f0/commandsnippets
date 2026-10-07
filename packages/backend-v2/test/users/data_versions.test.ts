import {
  backupSchema,
  DATA_VERSION_HEADER,
  dataVersionDocumentSchema,
  dataVersionListDocumentSchema,
  restoreResultSchema,
} from '@commandsnippets/api-shared';
import {and, eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {isDataVersionChanged} from '../../src/db/errors';
import {
  dataVersions,
  entryReuses,
  tags,
  tagsEntries,
  textEntries,
  type User,
  users,
} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {
  ApiClient,
  type Base,
  db,
  isoformat,
  json,
  refreshUser,
  richUserFactory as richUser,
  setUpBase,
  tokenFor,
} from '../helpers';
import {raceBeforeInsert, raceBeforeStatement} from '../support/races';

// v2: every user's data is in versions; their reads and writes are of the
// active one, and one that is not active never changes.

const VERSIONS = '/api/v1/user/data_versions';

const clientOf = async (user: User, bindings?: Cloudflare.Env) =>
  new ApiClient(await tokenFor(user.id), bindings);

async function backupOf(client: ApiClient) {
  return backupSchema.parse(
    await json(await client.get('/api/v1/user/backup'))
  );
}

/** Restore `client`'s own backup: a version 2 of the same content. */
async function restoreOwn(client: ApiClient): Promise<number> {
  const response = await client.post(
    '/api/v1/user/restore',
    await backupOf(client)
  );
  expect(response.status).toBe(200);
  return restoreResultSchema.parse(await json(response)).data_version;
}

const listVersions = async (client: ApiClient) => {
  const response = await client.get(VERSIONS);
  expect(response.status).toBe(200);
  return dataVersionListDocumentSchema.parse(await json(response)).data;
};

const activate = (client: ApiClient, version: number | string) =>
  client.post(`${VERSIONS}/${version}/activate`);

const rowsOf = async (user: User, version: number) => {
  const of = <
    T extends
      | typeof tags
      | typeof textEntries
      | typeof tagsEntries
      | typeof entryReuses,
  >(
    table: T
  ) =>
    db()
      .select({id: table.id})
      .from(table)
      .where(and(eq(table.user_id, user.id), eq(table.version, version)));
  return {
    tags: (await of(tags)).length,
    entries: (await of(textEntries)).length,
    taggings: (await of(tagsEntries)).length,
    reuses: (await of(entryReuses)).length,
  };
};

/** `write` fails as the data version triggers refuse it. */
async function expectRefused(write: Promise<unknown>) {
  const error = await write.then(
    () => undefined,
    (reason: unknown) => reason
  );
  expect(isDataVersionChanged(error)).toBe(true);
}

const createEntry = (client: ApiClient, headers: Record<string, string> = {}) =>
  client.request(
    'POST',
    '/api/v1/entries',
    {data: {type: 'TextEntry', attributes: {subject: 'made', body: 'body'}}},
    headers
  );

let base: Base;
let client: ApiClient;

beforeEach(async () => {
  base = await setUpBase();
  client = base.user1Client;
});

describe('GET /api/v1/user/data_versions', () => {
  it("lists a new account's first version, active", async () => {
    const [version] = await listVersions(client);
    expect(version).toEqual({
      type: 'DataVersion',
      id: '1',
      attributes: {
        version: 1,
        date_created: isoformat(base.user1.date_joined),
        active: true,
        origin: 'initial',
        backup_username: null,
        backup_exported: null,
        tag_count: 2,
        entry_count: 2,
      },
    });
  });

  it('lists every version, newest first, with what each holds', async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    await client.post('/api/v1/user/restore', backup);

    const versions = await listVersions(client);

    expect(versions.map(({attributes}) => attributes)).toEqual([
      {
        version: 2,
        date_created: expect.any(String),
        active: true,
        origin: 'restore',
        backup_username: source.username,
        backup_exported: backup.date_exported,
        tag_count: 2,
        entry_count: 3,
      },
      expect.objectContaining({version: 1, active: false, origin: 'initial'}),
    ]);
  });

  it('is refused without a session', async () => {
    expect((await base.unauthenticatedClient.get(VERSIONS)).status).toBe(403);
  });
});

describe('POST /api/v1/user/data_versions/:version/activate', () => {
  it('makes a version active again, its data what the user reads', async () => {
    const before = await backupOf(client);
    await restoreOwn(client);
    const revision = (await refreshUser(base.user1.id))?.public_revision ?? 0;

    const response = await activate(client, 1);

    expect(response.status).toBe(200);
    const {data} = dataVersionDocumentSchema.parse(await json(response));
    expect(data.attributes).toMatchObject({version: 1, active: true});
    expect((await refreshUser(base.user1.id))?.active_version).toBe(1);
    const user = await json(await client.get('/api/v1/user'));
    expect(user.data.attributes.data_version).toBe(1);
    expect({...(await backupOf(client)), date_exported: ''}).toEqual({
      ...before,
      date_exported: '',
    });
    // The public view moves with it.
    expect(
      (await refreshUser(base.user1.id))?.public_revision ?? 0
    ).toBeGreaterThan(revision);
  });

  it('changes nothing for the version already active', async () => {
    const revision = (await refreshUser(base.user1.id))?.public_revision;
    expect((await activate(client, 1)).status).toBe(200);
    expect((await refreshUser(base.user1.id))?.public_revision).toBe(revision);
  });

  it('answers a version the user does not have with a 404', async () => {
    for (const version of ['2', '0', 'one']) {
      const response = await activate(client, version);
      expect(response.status).toBe(404);
    }
    // Another user's version 2 is not theirs.
    await restoreOwn(await clientOf(base.user2));
    expect((await activate(client, 2)).status).toBe(404);
  });
});

describe('DELETE /api/v1/user/data_versions/:version', () => {
  it('deletes a version that is not active, rows and all', async () => {
    const user = await richUser();
    const own = await clientOf(user);
    await restoreOwn(own);
    expect(await rowsOf(user, 1)).toEqual({
      tags: 2,
      entries: 3,
      taggings: 3,
      reuses: 3,
    });

    const response = await own.delete(`${VERSIONS}/1`);

    expect(response.status).toBe(204);
    expect(await rowsOf(user, 1)).toEqual({
      tags: 0,
      entries: 0,
      taggings: 0,
      reuses: 0,
    });
    expect((await listVersions(own)).map(({id}) => id)).toEqual(['2']);
    // The active version is as it was.
    expect(await rowsOf(user, 2)).toEqual({
      tags: 2,
      entries: 3,
      taggings: 3,
      reuses: 3,
    });
  });

  it('never deletes the active version', async () => {
    const response = await client.delete(`${VERSIONS}/1`);
    expect(response.status).toBe(400);
    expect((await listVersions(client)).map(({id}) => id)).toEqual(['1']);
  });

  it('answers a version the user does not have with a 404', async () => {
    expect((await client.delete(`${VERSIONS}/7`)).status).toBe(404);
  });

  it('never gives a deleted version number out again', async () => {
    await restoreOwn(client);
    await restoreOwn(client);
    await activate(client, 1);
    expect((await client.delete(`${VERSIONS}/3`)).status).toBe(204);
    expect(await restoreOwn(client)).toBe(4);
  });
});

describe('the version a request names', () => {
  it('must be the active one: another is a 409, for reads and writes', async () => {
    await restoreOwn(client);
    const stale = {[DATA_VERSION_HEADER]: '1'};
    for (const response of [
      await client.get('/api/v1/tags', stale),
      await client.get(
        '/api/v1/entries?page[after]=1970-01-01T00:00:00.000000,0',
        stale
      ),
      await createEntry(client, stale),
    ]) {
      expect(response.status).toBe(409);
      expect((await json(response)).errors[0].code).toBe(
        'data_version_changed'
      );
    }
    expect(
      (await client.get('/api/v1/tags', {[DATA_VERSION_HEADER]: '2'})).status
    ).toBe(200);
    expect((await client.get('/api/v1/tags')).status).toBe(200);
  });

  it('must be a version number', async () => {
    const response = await client.get('/api/v1/tags', {
      [DATA_VERSION_HEADER]: 'latest',
    });
    expect(response.status).toBe(400);
  });

  it('decides what is read: only the rows of the active version', async () => {
    const before = await json(await client.get('/api/v1/entries'));
    await restoreOwn(client);
    const after = await json(await client.get('/api/v1/entries'));
    const ids = (body: {data: {id: string}[]}) => body.data.map(({id}) => id);
    expect(ids(after)).toHaveLength(ids(before).length);
    expect(ids(after).some(id => ids(before).includes(id))).toBe(false);
  });
});

describe('a version that is not active', () => {
  it("is no row to the API's writes", async () => {
    const [entry] = (await json(await client.get('/api/v1/entries'))).data;
    const [tag] = (await json(await client.get('/api/v1/tags'))).data;
    await restoreOwn(client);

    const edit = await client.patch(`/api/v1/entries/${entry.id}`, {
      data: {type: 'TextEntry', id: entry.id, attributes: {subject: 'stale'}},
    });
    expect(edit.status).toBe(404);
    const tagging = await client.post('/api/v1/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: {type: 'Tag', id: tag.id}},
          text_entry: {data: {type: 'TextEntry', id: entry.id}},
        },
      },
    });
    expect(tagging.status).toBe(400);
    const [row] = await db()
      .select()
      .from(textEntries)
      .where(eq(textEntries.id, Number(entry.id)));
    expect(row?.subject).not.toBe('stale');
  });

  it('never changes, in the database', async () => {
    const [entry] = await db()
      .select()
      .from(textEntries)
      .where(eq(textEntries.user_id, base.user1.id));
    if (entry === undefined) throw new Error('the user has entries');
    await restoreOwn(client);

    await expectRefused(
      db()
        .update(textEntries)
        .set({subject: 'stale'})
        .where(eq(textEntries.id, entry.id))
    );
    await expectRefused(
      db().delete(textEntries).where(eq(textEntries.id, entry.id))
    );
    await expectRefused(
      db().insert(textEntries).values({
        subject: 'stale',
        body: 'body',
        user_id: base.user1.id,
        version: 1,
        date_created: now(),
        date_updated: now(),
      })
    );
    // Nor moves to another version.
    await activate(client, 1);
    await expectRefused(
      db()
        .update(textEntries)
        .set({version: 2})
        .where(eq(textEntries.id, entry.id))
    );
  });

  it('nor takes a tagging of rows of another version', async () => {
    const [entry] = await db()
      .select()
      .from(textEntries)
      .where(eq(textEntries.user_id, base.user1.id));
    await restoreOwn(client);
    const [tag] = await db()
      .select()
      .from(tags)
      .where(and(eq(tags.user_id, base.user1.id), eq(tags.version, 2)));
    await expectRefused(
      db()
        .insert(tagsEntries)
        .values({
          tag_id: tag?.id ?? 0,
          text_entry_id: entry?.id ?? 0,
          user_id: base.user1.id,
          version: 2,
          order: 9,
          date_created: now(),
          date_updated: now(),
        })
    );
  });
});

describe('a switch that lands while a write is on its way', () => {
  it('refuses a create in its own statement', async () => {
    await restoreOwn(client);
    // Version 1 becomes active after the create is checked, before it
    // inserts.
    const raced = await clientOf(
      base.user1,
      raceBeforeInsert('text_entries_textentry', () => activate(client, 1))
    );

    const response = await createEntry(raced, {[DATA_VERSION_HEADER]: '2'});

    expect(response.status).toBe(409);
    expect((await json(response)).errors[0].code).toBe('data_version_changed');
    expect((await rowsOf(base.user1, 2)).entries).toBe(2);
  });

  it('refuses a reorder in its move', async () => {
    await restoreOwn(client);
    const [top, bottom] = (await json(await client.get('/api/v1/tags'))).data;
    const raced = await clientOf(
      base.user1,
      raceBeforeStatement(/^\s*update "tags_tag"\s+set "order"/i, () =>
        activate(client, 1)
      )
    );

    const response = await raced.post('/api/v1/tags/reorder', {
      data: {type: 'Tag', attributes: {top: bottom.id, bottom: top.id}},
    });

    expect(response.status).toBe(409);
  });

  it('refuses a delete in its update', async () => {
    await restoreOwn(client);
    const [tag] = (await json(await client.get('/api/v1/tags'))).data;
    const raced = await clientOf(
      base.user1,
      raceBeforeStatement(/^\s*update "tags_tag" set/i, () =>
        activate(client, 1)
      )
    );

    const response = await raced.delete(`/api/v1/tags/${tag.id}`);

    expect(response.status).toBe(409);
    const [row] = await db()
      .select()
      .from(tags)
      .where(eq(tags.id, Number(tag.id)));
    expect(row?.is_deleted).toBe(false);
  });
});

describe('a delete and a switch at once', () => {
  it('answers a switch to a version deleted meanwhile with a 404', async () => {
    await restoreOwn(client);
    await activate(client, 1);
    const raced = await clientOf(
      base.user1,
      raceBeforeStatement(
        /^\s*update "users_user" set .*"active_version"/is,
        () => client.delete(`${VERSIONS}/2`)
      )
    );

    expect((await activate(raced, 2)).status).toBe(404);
    expect((await refreshUser(base.user1.id))?.active_version).toBe(1);
  });

  it('deletes nothing of a version made active meanwhile', async () => {
    await restoreOwn(client);
    const raced = await clientOf(
      base.user1,
      raceBeforeStatement(/^\s*delete from "users_dataversion"/i, () =>
        activate(client, 1)
      )
    );

    expect((await raced.delete(`${VERSIONS}/1`)).status).toBe(400);
    expect((await rowsOf(base.user1, 1)).entries).toBe(2);
    expect((await listVersions(client)).map(({id}) => id)).toEqual(['2', '1']);
  });
});

describe('two restores at once', () => {
  it('make a version each, the one committed last active', async () => {
    const backup = await backupOf(client);
    let first = 0;
    const raced = await clientOf(
      base.user1,
      raceBeforeStatement(/insert into "users_dataversion"/i, async () => {
        const response = await client.post('/api/v1/user/restore', backup);
        first = restoreResultSchema.parse(await json(response)).data_version;
      })
    );

    const response = await raced.post('/api/v1/user/restore', backup);

    expect(response.status).toBe(200);
    const second = restoreResultSchema.parse(await json(response)).data_version;
    expect([first, second]).toEqual([2, 3]);
    expect((await refreshUser(base.user1.id))?.active_version).toBe(3);
    expect((await listVersions(client)).map(({id}) => id)).toEqual([
      '3',
      '2',
      '1',
    ]);
  });
});

describe("another user's data", () => {
  it('is read at their active version by staff, and by the public', async () => {
    const owner = await richUser();
    const own = await clientOf(owner);
    await restoreOwn(own);
    await db()
      .update(users)
      .set({is_staff: true})
      .where(eq(users.id, base.user1.id));
    const staff = await clientOf(base.user1);

    const read = await json(
      await staff.get(`/api/v1/admin/users/${owner.id}/entries`)
    );
    const versioned = await db()
      .select({id: textEntries.id})
      .from(textEntries)
      .where(
        and(eq(textEntries.user_id, owner.id), eq(textEntries.version, 2))
      );
    expect(read.data.map(({id}: {id: string}) => Number(id)).sort()).toEqual(
      versioned.map(({id}) => id).sort()
    );
    const stale = await staff.get(`/api/v1/admin/users/${owner.id}/entries`, {
      [DATA_VERSION_HEADER]: '1',
    });
    expect(stale.status).toBe(409);
    const admin = await json(
      await staff.get(`/api/v1/admin/users/${owner.id}`)
    );
    expect(admin.data.attributes).toMatchObject({
      data_version: 2,
      entry_count: 3,
      tag_count: 2,
    });

    const publicTags = await json(
      await base.unauthenticatedClient.get(
        `/api/v1/users/${owner.username}/tags`
      )
    );
    const versionedTags = await db()
      .select({id: tags.id})
      .from(tags)
      .where(
        and(
          eq(tags.user_id, owner.id),
          eq(tags.version, 2),
          eq(tags.is_public, true)
        )
      );
    expect(publicTags.data.map(({id}: {id: string}) => Number(id))).toEqual(
      versionedTags.map(({id}) => id)
    );
  });
});

describe('a backup of a version', () => {
  it('is of the one `?version=` names, or the active one', async () => {
    const before = await backupOf(client);
    await restoreOwn(client);

    const old = await json(await client.get('/api/v1/user/backup?version=1'));
    expect(old.entries.map(({id}: {id: string}) => id)).toEqual(
      before.entries.map(({id}) => id)
    );
    for (const version of ['7', 'x']) {
      expect(
        (await client.get(`/api/v1/user/backup?version=${version}`)).status
      ).toBe(404);
    }
  });
});

describe('an account with versions', () => {
  it('is deleted with all of them', async () => {
    const owner = await richUser();
    await restoreOwn(await clientOf(owner));
    await db().delete(users).where(eq(users.id, owner.id));
    expect(await rowsOf(owner, 1)).toEqual({
      tags: 0,
      entries: 0,
      taggings: 0,
      reuses: 0,
    });
    expect(await rowsOf(owner, 2)).toEqual({
      tags: 0,
      entries: 0,
      taggings: 0,
      reuses: 0,
    });
    const left = await db()
      .select()
      .from(dataVersions)
      .where(eq(dataVersions.user_id, owner.id));
    expect(left).toEqual([]);
  });
});
