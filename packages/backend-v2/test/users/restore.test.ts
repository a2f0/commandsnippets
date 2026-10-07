import {
  type Backup,
  backupSchema,
  DATA_VERSION_HEADER,
  restoreResultSchema,
} from '@commandsnippets/api-shared';
import {and, asc, eq, sql} from 'drizzle-orm';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {
  dataVersions,
  entryReuses,
  tags,
  tagsEntries,
  textEntries,
  type User,
} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {
  CHUNK_BYTES,
  chunked,
  prepareRestore,
  restoreInto,
} from '../../src/resources/restore';
import {
  ApiClient,
  type Base,
  db,
  json,
  refreshUser,
  richUserFactory as richUser,
  setUpBase,
  tokenFor,
  userFactory,
} from '../helpers';
import {raceBeforeStatement} from '../support/races';

// v2: restoring a backup makes it the requester's data, as a new version.

const clientOf = async (user: User) => new ApiClient(await tokenFor(user.id));

async function backupOf(client: ApiClient, version?: number): Promise<Backup> {
  const response = await client.get(
    `/api/v1/user/backup${version === undefined ? '' : `?version=${version}`}`
  );
  expect(response.status).toBe(200);
  return backupSchema.parse(await json(response));
}

/**
 * Restore `body` as `client`, whose writes then name the version it made
 * (as the app's do once it holds it).
 */
async function restore(client: ApiClient, body: unknown): Promise<Response> {
  const response = await client.post('/api/v1/user/restore', body);
  if (response.status === 200) {
    client.dataVersion = restoreResultSchema.parse(
      await response.clone().json()
    ).data_version;
  }
  return response;
}

/**
 * A backup's content without ids or revisions: what a restore must make
 * again, its references followed to what they name.
 */
function contentOf(backup: Backup) {
  const tagName = new Map(backup.tags.map(tag => [tag.id, tag.name]));
  const subject = new Map(
    backup.entries.map(entry => [entry.id, entry.subject])
  );
  return {
    tags: backup.tags.map(({name, is_public, date_created}) => ({
      name,
      is_public,
      date_created,
    })),
    entries: backup.entries.map(({subject, body, is_public, date_created}) => ({
      subject,
      body,
      is_public,
      date_created,
    })),
    tags_entries: backup.tags_entries.map(row => ({
      tag: tagName.get(row.tag_id),
      entry: subject.get(row.text_entry_id),
      date_created: row.date_created,
    })),
    entry_reuses: backup.entry_reuses.map(row => ({
      entry: subject.get(row.text_entry_id),
      date_created: row.date_created,
    })),
  };
}

/** A backup with its export time left out, which changes at every export. */
const undated = (backup: Backup) => ({...backup, date_exported: ''});

/** `user`'s live tags of `version`, in their order. */
const liveTags = (user: User, version: number) =>
  db()
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.user_id, user.id),
        eq(tags.version, version),
        eq(tags.is_deleted, false)
      )
    )
    .orderBy(asc(tags.order));

/** `user`'s live entries of `version`, oldest first. */
const liveEntries = (user: User, version: number) =>
  db()
    .select()
    .from(textEntries)
    .where(
      and(
        eq(textEntries.user_id, user.id),
        eq(textEntries.version, version),
        eq(textEntries.is_deleted, false)
      )
    )
    .orderBy(asc(textEntries.id));

/** `user`'s version numbers. */
const versionsOf = async (user: User) =>
  (
    await db()
      .select()
      .from(dataVersions)
      .where(eq(dataVersions.user_id, user.id))
      .orderBy(asc(dataVersions.version))
  ).map(row => row.version);

describe('POST /api/v1/user/restore', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it("makes another account's backup the user's data, keeping the version before", async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    const before = await backupOf(base.user1Client);

    const response = await restore(base.user1Client, backup);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(restoreResultSchema.parse(await json(response))).toEqual({
      data_version: 2,
      tags: 2,
      entries: 3,
      tags_entries: 3,
      entry_reuses: 3,
    });
    expect((await refreshUser(base.user1.id))?.active_version).toBe(2);
    expect(await versionsOf(base.user1)).toEqual([1, 2]);
    const restored = await backupOf(base.user1Client);
    expect(contentOf(restored)).toEqual(contentOf(backup));
    expect(restored.user.username).toBe(base.user1.username);
    // Made anew: none of the backup's ids.
    const backupIds = new Set(backup.entries.map(entry => entry.id));
    for (const entry of restored.entries) {
      expect(backupIds.has(entry.id)).toBe(false);
    }
    // The version before is as it was, ids and all.
    expect(undated(await backupOf(base.user1Client, 1))).toEqual(
      undated(before)
    );
    // And the source account is untouched.
    expect(undated(await backupOf(await clientOf(source)))).toEqual(
      undated(backup)
    );
  });

  it('records where the version came from, and moves the public view to it', async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    const revision = (await refreshUser(base.user1.id))?.public_revision ?? 0;

    await restore(base.user1Client, backup);

    const [version] = await db()
      .select()
      .from(dataVersions)
      .where(
        and(
          eq(dataVersions.user_id, base.user1.id),
          eq(dataVersions.version, 2)
        )
      );
    expect(version).toMatchObject({
      origin: 'restore',
      backup_username: source.username,
    });
    expect(version?.backup_exported?.startsWith(backup.date_exported)).toBe(
      true
    );
    expect(
      (await refreshUser(base.user1.id))?.public_revision ?? 0
    ).toBeGreaterThan(revision);
  });

  it('works out the counters and dates from the rows made', async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    await restore(base.user1Client, backup);

    const [shell, git] = await liveTags(base.user1, 2);
    expect(shell).toMatchObject({name: 'shell', entry_count: 2});
    expect(git).toMatchObject({name: 'git', entry_count: 1, is_public: true});
    const newest = (name: string) =>
      backup.tags_entries
        .filter(
          row => backup.tags.find(tag => tag.id === row.tag_id)?.name === name
        )
        .map(row => row.date_created)
        .sort()
        .at(-1);
    expect(shell?.date_last_used?.startsWith(newest('shell') ?? '-')).toBe(
      true
    );
    const entries = await liveEntries(base.user1, 2);
    expect(
      entries.map(entry => [
        entry.subject,
        entry.tag_count,
        entry.reused_count,
        entry.is_public,
      ])
    ).toEqual([
      ['list', 1, 2, false],
      ['log', 2, 0, true],
      ['alone', 0, 1, false],
    ]);
    const lsReuses = backup.entry_reuses
      .filter(
        row =>
          backup.entries.find(entry => entry.id === row.text_entry_id)
            ?.subject === 'list'
      )
      .map(row => row.date_created)
      .sort();
    expect(entries[0]?.reused_date?.startsWith(lsReuses.at(-1) ?? '-')).toBe(
      true
    );
    // Search finds restored entries (their folded columns are written).
    const found = await json(
      await base.user1Client.get('/api/v1/entries?filter[search]=LOG')
    );
    expect(
      found.data.map(
        (entry: {attributes: {subject: string}}) => entry.attributes.subject
      )
    ).toEqual(['log']);
  });

  it("restores the user's own backup as a version of rows of its own", async () => {
    const user = await richUser();
    const client = await clientOf(user);
    const backup = await backupOf(client);

    expect((await restore(client, backup)).status).toBe(200);

    const restored = await backupOf(client);
    expect(contentOf(restored)).toEqual(contentOf(backup));
    for (const [made, old] of [
      [restored.tags, backup.tags],
      [restored.entries, backup.entries],
      [restored.tags_entries, backup.tags_entries],
      [restored.entry_reuses, backup.entry_reuses],
    ] as const) {
      const oldIds = new Set(old.map(row => row.id));
      expect(made.some(row => oldIds.has(row.id))).toBe(false);
    }
    // Version 1 keeps its rows, live.
    expect((await liveTags(user, 1)).map(tag => tag.name)).toEqual([
      'shell',
      'git',
    ]);
  });

  it('ranks tags in the backup order, and taggings in their tag order', async () => {
    const user = await userFactory({}, {examples: false});
    const client = await clientOf(user);
    const at = now();
    const backup: Backup = {
      ...(await backupOf(client)),
      tags: [
        {
          id: '1',
          name: 'second',
          order: 5,
          is_public: false,
          date_created: at,
          date_updated: at,
        },
        {
          id: '2',
          name: 'first',
          order: 2,
          is_public: false,
          date_created: at,
          date_updated: at,
        },
      ],
      entries: ['a', 'b', 'c'].map((subject, index) => ({
        id: String(10 + index),
        subject,
        body: 'body',
        is_public: false,
        date_created: at,
        date_updated: at,
      })),
      tags_entries: (
        [
          ['20', '12', 9],
          ['21', '10', 1],
          ['22', '11', 4],
        ] as const
      ).map(([id, entry, order]) => ({
        id,
        tag_id: '1',
        text_entry_id: entry,
        order,
        date_created: at,
        date_updated: at,
      })),
      entry_reuses: [],
    };

    expect((await restore(client, backup)).status).toBe(200);

    const restoredTags = await liveTags(user, 2);
    expect(restoredTags.map(tag => [tag.name, tag.order])).toEqual([
      ['first', 0],
      ['second', 1],
    ]);
    const taggings = await db()
      .select({order: tagsEntries.order, subject: textEntries.subject})
      .from(tagsEntries)
      .innerJoin(textEntries, eq(textEntries.id, tagsEntries.text_entry_id))
      .where(eq(tagsEntries.tag_id, restoredTags[1]?.id ?? 0))
      .orderBy(asc(tagsEntries.order));
    expect(taggings).toEqual([
      {order: 0, subject: 'a'},
      {order: 1, subject: 'b'},
      {order: 2, subject: 'c'},
    ]);
  });

  it('makes the same rows when every row goes in a statement of its own', async () => {
    const backup = await backupOf(await clientOf(await richUser()));
    const user = await userFactory({}, {examples: false});

    expect(
      await restoreInto(db(), user.id, prepareRestore(backup), {chunkBytes: 1})
    ).toBe(2);

    expect(contentOf(await backupOf(await clientOf(user)))).toEqual(
      contentOf(backup)
    );
  });

  it('makes an empty version of an empty backup', async () => {
    const backup = await backupOf(base.user1Client);
    const empty = {
      ...backup,
      tags: [],
      entries: [],
      tags_entries: [],
      entry_reuses: [],
    };
    expect((await restore(base.user1Client, empty)).status).toBe(200);
    expect(await liveTags(base.user1, 2)).toEqual([]);
    expect(await liveEntries(base.user1, 2)).toEqual([]);
    expect(
      (await json(await base.user1Client.get('/api/v1/tags'))).data
    ).toEqual([]);
    expect((await liveTags(base.user1, 1)).length).toBeGreaterThan(0);
  });

  it('numbers each restore one past the last, and makes it active', async () => {
    const backup = await backupOf(base.user1Client);
    for (const expected of [2, 3]) {
      const response = await restore(base.user1Client, backup);
      expect(restoreResultSchema.parse(await json(response)).data_version).toBe(
        expected
      );
    }
    expect(await versionsOf(base.user1)).toEqual([1, 2, 3]);
    expect((await refreshUser(base.user1.id))?.active_version).toBe(3);
  });

  it('is refused over another version than the one the client names', async () => {
    const backup = await backupOf(base.user1Client);
    await restore(base.user1Client, backup);

    const response = await base.user1Client.request(
      'POST',
      '/api/v1/user/restore',
      backup,
      {[DATA_VERSION_HEADER]: '1'}
    );

    expect(response.status).toBe(409);
    expect((await json(response)).errors[0].code).toBe('data_version_changed');
    expect(await versionsOf(base.user1)).toEqual([1, 2]);
  });

  it('is refused without a session', async () => {
    const backup = await backupOf(base.user1Client);
    const response = await restore(base.unauthenticatedClient, backup);
    expect(response.status).toBe(403);
    expect((await json(response)).errors[0].code).toBe('not_authenticated');
  });

  describe('refuses an invalid backup, making no version', () => {
    let backup: Backup;

    beforeEach(async () => {
      backup = await backupOf(await clientOf(await richUser()));
    });

    const refused = async (body: unknown, pointer: string, detail: RegExp) => {
      const response = await restore(base.user1Client, body);
      expect(response.status).toBe(400);
      const [error] = (await json(response)).errors;
      expect(error.source.pointer).toBe(pointer);
      expect(error.detail).toMatch(detail);
      expect(await versionsOf(base.user1)).toEqual([1]);
      expect((await refreshUser(base.user1.id))?.last_version).toBe(1);
    };

    it('of another format or version', async () => {
      await refused(
        {...backup, format: 'other'},
        '/format',
        /^Invalid backup at \/format: /
      );
      await refused({...backup, version: 2}, '/version', /version/);
      await refused({}, '/format', /format/);
    });

    it('with fields a create refuses', async () => {
      const [tag] = backup.tags;
      const [entry] = backup.entries;
      await refused(
        {...backup, tags: [{...tag, name: 'x'.repeat(25)}]},
        '/tags/0/name',
        /no more than 24 characters/
      );
      await refused(
        {
          ...backup,
          entries: [{...entry, subject: '  '}, ...backup.entries.slice(1)],
        },
        '/entries/0/subject',
        /blank/
      );
      await refused(
        {
          ...backup,
          entries: [
            {...entry, date_created: '2024-13-01T00:00:00'},
            ...backup.entries.slice(1),
          ],
        },
        '/entries/0/date_created',
        /date and time/
      );
    });

    it('with ids that repeat or name nothing in it', async () => {
      const [first, second] = backup.tags;
      await refused(
        {...backup, tags: [first, {...second, name: first?.name}]},
        '/tags/1/name',
        /named/
      );
      await refused(
        {...backup, tags: [first, {...second, id: first?.id}]},
        '/tags/1/id',
        /id/
      );
      const [entry, other] = backup.entries;
      await refused(
        {
          ...backup,
          entries: [
            entry,
            {...other, id: entry?.id},
            ...backup.entries.slice(2),
          ],
        },
        '/entries/1/id',
        /id/
      );
      const [tagging] = backup.tags_entries;
      await refused(
        {...backup, tags_entries: [{...tagging, tag_id: '999999'}]},
        '/tags_entries/0/tag_id',
        /No tag/
      );
      await refused(
        {...backup, tags_entries: [{...tagging, text_entry_id: '999999'}]},
        '/tags_entries/0/text_entry_id',
        /No entry/
      );
      await refused(
        {...backup, tags_entries: [tagging, {...tagging, id: '999999'}]},
        '/tags_entries/1',
        /same tag and entry/
      );
      const [reuse] = backup.entry_reuses;
      await refused(
        {...backup, entry_reuses: [{...reuse, text_entry_id: '999999'}]},
        '/entry_reuses/0/text_entry_id',
        /No entry/
      );
    });

    it('that is not JSON', async () => {
      const response = await base.user1Client.request(
        'POST',
        '/api/v1/user/restore',
        undefined,
        {'Content-Type': 'application/json'}
      );
      expect(response.status).toBe(400);
      expect((await json(response)).errors[0].code).toBe('parse_error');
    });
  });
});

describe('a restore, as one transaction', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  /** What a restore would have left of itself: none of it. */
  async function expectNoTrace(user: User, revision: number | undefined) {
    expect(await versionsOf(user)).toEqual([1]);
    expect(await refreshUser(user.id)).toMatchObject({
      active_version: 1,
      last_version: 1,
      public_revision: revision,
    });
    for (const table of [tags, textEntries, tagsEntries, entryReuses]) {
      const rows = await db()
        .select({id: table.id})
        .from(table)
        .where(and(eq(table.user_id, user.id), eq(table.version, 2)));
      expect(rows).toEqual([]);
    }
  }

  it('is undone whole when its last write fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const backup = await backupOf(await clientOf(await richUser()));
    const at = now();
    // A tag no tagging dates, which only the batch's last write touches:
    // made to fail there, after every row is in.
    const withUnused = {
      ...backup,
      tags: [
        ...backup.tags,
        {
          id: '999999',
          name: 'unused',
          order: 99,
          is_public: false,
          date_created: at,
          date_updated: at,
        },
      ],
    };
    const revision = (await refreshUser(base.user1.id))?.public_revision;
    await db().run(
      sql.raw(`CREATE TRIGGER test_fail_last_write
        BEFORE UPDATE OF date_last_used ON tags_tag
        WHEN NEW.name = 'unused'
        BEGIN SELECT RAISE(ABORT, 'failed on purpose'); END`)
    );
    try {
      const response = await restore(base.user1Client, withUnused);
      expect(response.status).toBe(500);
    } finally {
      await db().run(sql.raw('DROP TRIGGER test_fail_last_write'));
    }

    await expectNoTrace(base.user1, revision);
    // And it goes through once nothing fails.
    expect((await restore(base.user1Client, withUnused)).status).toBe(200);
  });

  it('is refused over a version made inactive after its check, in its batch', async () => {
    const backup = await backupOf(base.user1Client);
    // Another restore commits after this one is checked, before its batch.
    const raced = new ApiClient(
      await tokenFor(base.user1.id),
      raceBeforeStatement(/insert into "users_dataversion"/i, () =>
        restore(base.user1Client, backup)
      )
    );

    const response = await raced.request(
      'POST',
      '/api/v1/user/restore',
      backup,
      {[DATA_VERSION_HEADER]: '1'}
    );

    expect(response.status).toBe(409);
    expect((await json(response)).errors[0].code).toBe('data_version_changed');
    // Only the other restore's version: none of this one is left.
    expect(await versionsOf(base.user1)).toEqual([1, 2]);
    expect(await refreshUser(base.user1.id)).toMatchObject({
      active_version: 2,
      last_version: 2,
    });
    const third = await db()
      .select({id: tags.id})
      .from(tags)
      .where(and(eq(tags.user_id, base.user1.id), eq(tags.version, 3)));
    expect(third).toEqual([]);
  });

  it('goes through over the active version it names', async () => {
    const backup = await backupOf(base.user1Client);
    const response = await base.user1Client.request(
      'POST',
      '/api/v1/user/restore',
      backup,
      {[DATA_VERSION_HEADER]: '1'}
    );
    expect(response.status).toBe(200);
    expect(restoreResultSchema.parse(await json(response)).data_version).toBe(
      2
    );
  });
});

describe('restored reuses', () => {
  it('count toward the entry they name, in the new version', async () => {
    const backup = await backupOf(await clientOf(await richUser()));
    const target = await userFactory({}, {examples: false});
    await restore(await clientOf(target), backup);
    const reuses = await db()
      .select()
      .from(entryReuses)
      .where(eq(entryReuses.user_id, target.id));
    expect(reuses.map(row => row.version)).toEqual([2, 2, 2]);
  });
});

describe('chunked', () => {
  it('keeps runs under the size, in order, every row in one', () => {
    const rows = [{a: 'x'}, {a: 'yy'}, {a: 'zzz'}];
    expect(chunked(rows, 1)).toEqual([[rows[0]], [rows[1]], [rows[2]]]);
    expect(chunked(rows, 25)).toEqual([[rows[0], rows[1]], [rows[2]]]);
    expect(chunked(rows)).toEqual([rows]);
    expect(chunked([])).toEqual([]);
    expect(CHUNK_BYTES).toBeLessThan(2_000_000);
  });
});
