import {
  type Backup,
  backupSchema,
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
  restoreResultSchema,
} from '@commandsnippets/api-shared';
import {and, asc, eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  entryReuses,
  type Tag,
  type TextEntry,
  tags,
  tagsEntries,
  textEntries,
  type User,
  users,
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
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  textEntryReusedFactory,
  tokenFor,
  userFactory,
} from '../helpers';

// v2: restoring a backup replaces all of the requester's data.

const clientOf = async (user: User) => new ApiClient(await tokenFor(user.id));

async function backupOf(client: ApiClient): Promise<Backup> {
  const response = await client.get('/api/v1/user/backup');
  expect(response.status).toBe(200);
  return backupSchema.parse(await json(response));
}

const restore = (client: ApiClient, body: unknown) =>
  client.post('/api/v1/user/restore', body);

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

/** A user with tags, entries (one public), taggings and reuses. */
async function richUser(): Promise<User> {
  const user = await userFactory({}, {examples: false});
  const shell = await tagFactory({user, name: 'shell'});
  const git = await tagFactory({user, name: 'git'});
  await db().update(tags).set({is_public: true}).where(eq(tags.id, git.id));
  const ls = await textEntryFactory({user, subject: 'list', body: 'ls -la'});
  const log = await textEntryFactory({user, subject: 'log', body: 'git log'});
  const untagged = await textEntryFactory({user, subject: 'alone'});
  await db()
    .update(textEntries)
    .set({is_public: true})
    .where(eq(textEntries.id, log.id));
  await tagTextEntryFactory({tag: shell, text_entry: log, user, order: 0});
  await tagTextEntryFactory({tag: shell, text_entry: ls, user, order: 1});
  await tagTextEntryFactory({tag: git, text_entry: log, user, order: 0});
  await textEntryReusedFactory({text_entry: ls, user});
  await textEntryReusedFactory({text_entry: ls, user});
  await textEntryReusedFactory({text_entry: untagged, user});
  return user;
}

const liveTags = (user: User) =>
  db()
    .select()
    .from(tags)
    .where(and(eq(tags.user_id, user.id), eq(tags.is_deleted, false)))
    .orderBy(asc(tags.order));

const liveEntries = (user: User) =>
  db()
    .select()
    .from(textEntries)
    .where(
      and(eq(textEntries.user_id, user.id), eq(textEntries.is_deleted, false))
    )
    .orderBy(asc(textEntries.id));

describe('POST /api/v1/user/restore', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it("replaces the user's data with another account's backup", async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    const before = await liveEntries(base.user1);
    expect(before.length).toBeGreaterThan(0);

    const response = await restore(base.user1Client, backup);

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(restoreResultSchema.parse(await json(response))).toEqual({
      date_restored: expect.any(String),
      tags: 2,
      entries: 3,
      tags_entries: 3,
      entry_reuses: 3,
    });
    const restored = await backupOf(base.user1Client);
    expect(contentOf(restored)).toEqual(contentOf(backup));
    expect(restored.user.username).toBe(base.user1.username);
    // Made anew: none of the backup's ids, and the old rows are deleted.
    const backupIds = new Set(backup.entries.map(entry => entry.id));
    for (const entry of restored.entries) {
      expect(backupIds.has(entry.id)).toBe(false);
    }
    for (const entry of before) {
      const [row] = await db()
        .select()
        .from(textEntries)
        .where(eq(textEntries.id, entry.id));
      expect(row?.is_deleted).toBe(true);
    }
    // The source account is untouched.
    expect(await backupOf(await clientOf(source))).toEqual({
      ...backup,
      date_exported: expect.any(String),
    });
  });

  it('works out the counters and dates from the rows made', async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    await restore(base.user1Client, backup);

    const [shell, git] = await liveTags(base.user1);
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
    const entries = await liveEntries(base.user1);
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

  it("restores the user's own backup, bringing tags back in place", async () => {
    const user = await richUser();
    const client = await clientOf(user);
    const backup = await backupOf(client);
    const tagIds = (await liveTags(user)).map(tag => tag.id);

    expect((await restore(client, backup)).status).toBe(200);

    const restored = await backupOf(client);
    expect(contentOf(restored)).toEqual(contentOf(backup));
    // Names are unique per user, so the tags are the same rows.
    expect((await liveTags(user)).map(tag => tag.id)).toEqual(tagIds);
    // The entries and taggings are new.
    expect(
      restored.entries.some(entry =>
        backup.entries.some(old => old.id === entry.id)
      )
    ).toBe(false);
    expect(
      restored.tags_entries.some(row =>
        backup.tags_entries.some(old => old.id === row.id)
      )
    ).toBe(false);
  });

  it('ranks tags after every tag the user has, and taggings in order', async () => {
    const user = await userFactory({}, {examples: false});
    const client = await clientOf(user);
    await tagFactory({user, name: 'old', order: 7, is_deleted: true});
    const entries = await Promise.all(
      ['a', 'b', 'c'].map(subject => textEntryFactory({user, subject}))
    );
    const backup: Backup = {
      ...(await backupOf(client)),
      tags: [
        {
          id: '1',
          name: 'second',
          order: 5,
          is_public: false,
          date_created: now(),
          date_updated: now(),
        },
        {
          id: '2',
          name: 'first',
          order: 2,
          is_public: false,
          date_created: now(),
          date_updated: now(),
        },
      ],
      entries: entries.map(entry => ({
        id: String(entry.id),
        subject: entry.subject,
        body: entry.body,
        is_public: false,
        date_created: now(),
        date_updated: now(),
      })),
      tags_entries: [
        {
          id: '10',
          tag_id: '1',
          text_entry_id: String(entries[2]?.id),
          order: 9,
          date_created: now(),
          date_updated: now(),
        },
        {
          id: '11',
          tag_id: '1',
          text_entry_id: String(entries[0]?.id),
          order: 1,
          date_created: now(),
          date_updated: now(),
        },
        {
          id: '12',
          tag_id: '1',
          text_entry_id: String(entries[1]?.id),
          order: 4,
          date_created: now(),
          date_updated: now(),
        },
      ],
      entry_reuses: [],
    };

    expect((await restore(client, backup)).status).toBe(200);

    const restoredTags = await liveTags(user);
    expect(restoredTags.map(tag => [tag.name, tag.order])).toEqual([
      ['first', 8],
      ['second', 9],
    ]);
    const second = restoredTags[1];
    const taggings = await db()
      .select({order: tagsEntries.order, subject: textEntries.subject})
      .from(tagsEntries)
      .innerJoin(textEntries, eq(textEntries.id, tagsEntries.text_entry_id))
      .where(
        and(
          eq(tagsEntries.tag_id, second?.id ?? 0),
          eq(tagsEntries.is_deleted, false)
        )
      )
      .orderBy(asc(tagsEntries.order));
    expect(taggings).toEqual([
      {order: 0, subject: 'a'},
      {order: 1, subject: 'b'},
      {order: 2, subject: 'c'},
    ]);
  });

  it('makes the same rows when every row goes in a statement of its own', async () => {
    const source = await richUser();
    const backup = await backupOf(await clientOf(source));
    const user = await userFactory({}, {examples: false});
    await tagFactory({user, name: 'shell'});

    await restoreInto(db(), user.id, now(), prepareRestore(backup), 1);

    const restored = await backupOf(await clientOf(user));
    expect(contentOf(restored)).toEqual(contentOf(backup));
    const [shell] = await liveTags(user);
    const orders = await db()
      .select({order: tagsEntries.order})
      .from(tagsEntries)
      .where(
        and(
          eq(tagsEntries.tag_id, shell?.id ?? 0),
          eq(tagsEntries.is_deleted, false)
        )
      )
      .orderBy(asc(tagsEntries.order));
    expect(orders).toEqual([{order: 0}, {order: 1}]);
  });

  it('deletes everything for an empty backup', async () => {
    const backup = await backupOf(base.user1Client);
    const empty = {
      ...backup,
      tags: [],
      entries: [],
      tags_entries: [],
      entry_reuses: [],
    };
    expect((await restore(base.user1Client, empty)).status).toBe(200);
    expect(await liveTags(base.user1)).toEqual([]);
    expect(await liveEntries(base.user1)).toEqual([]);
    const live = await db()
      .select()
      .from(tagsEntries)
      .where(
        and(
          eq(tagsEntries.user_id, base.user1.id),
          eq(tagsEntries.is_deleted, false)
        )
      );
    expect(live).toEqual([]);
  });

  it("lists the restore's deletes and rows to a sync from before it", async () => {
    const page = await json(
      await base.user1Client.get(
        '/api/v1/entries?page[after]=1970-01-01T00:00:00.000000,0&page[size]=100'
      )
    );
    const last = page.data.at(-1);
    const cursor = `${last.attributes.date_updated},${last.id}`;
    const old = page.data.map((entry: {id: string}) => entry.id);
    const source = await richUser();
    await restore(base.user1Client, await backupOf(await clientOf(source)));

    const changed = await json(
      await base.user1Client.get(
        `/api/v1/entries?page[after]=${encodeURIComponent(cursor)}&page[size]=100`
      )
    );
    const byId = new Map(
      changed.data.map(
        (entry: {id: string; attributes: {is_deleted: boolean}}) => [
          entry.id,
          entry.attributes.is_deleted,
        ]
      )
    );
    for (const id of old) {
      expect(byId.get(id)).toBe(true);
    }
    expect([...byId.values()].filter(deleted => !deleted)).toHaveLength(3);
  });

  describe('refuses client writes made before it', () => {
    const minuteAgo = () => new Date(Date.now() - 60_000).toISOString();
    let entry: TextEntry;
    let tag: Tag;

    beforeEach(async () => {
      const [firstEntry] = await liveEntries(base.user1);
      const [firstTag] = await liveTags(base.user1);
      if (firstEntry === undefined || firstTag === undefined) {
        throw new Error('the user has data');
      }
      entry = firstEntry;
      tag = firstTag;
    });

    /** `send` made a minute ago, after a restore made now: refused. */
    async function refusedAfterRestore(
      send: (headers: Record<string, string>) => Promise<Response>
    ) {
      const made = minuteAgo();
      await restore(base.user1Client, await backupOf(base.user1Client));
      const response = await send({[CLIENT_UPDATED_HEADER]: made});
      expect(response.status).toBe(400);
      const [error] = (await json(response)).errors;
      expect(error.code).toBe('data_restored');
      return response;
    }

    it('creates, which would bring back what it replaced', async () => {
      const entriesBefore = (await liveEntries(base.user1)).length;
      await refusedAfterRestore(headers =>
        base.user1Client.request(
          'POST',
          '/api/v1/entries',
          {
            data: {
              type: 'TextEntry',
              attributes: {subject: 'made offline', body: 'body'},
            },
          },
          headers
        )
      );
      await refusedAfterRestore(headers =>
        base.user1Client.request(
          'POST',
          '/api/v1/tags',
          {data: {type: 'Tag', attributes: {name: 'made-offline'}}},
          headers
        )
      );
      const restored = await liveEntries(base.user1);
      expect(restored).toHaveLength(entriesBefore);
      expect(restored.map(row => row.subject)).not.toContain('made offline');
      expect((await liveTags(base.user1)).map(row => row.name)).not.toContain(
        'made-offline'
      );
    });

    it('edits and deletes of the rows it deleted', async () => {
      await refusedAfterRestore(headers =>
        base.user1Client.request(
          'PATCH',
          `/api/v1/entries/${entry.id}`,
          {
            data: {
              type: 'TextEntry',
              id: String(entry.id),
              attributes: {subject: 'edited offline', is_deleted: false},
            },
          },
          headers
        )
      );
      const [row] = await db()
        .select()
        .from(textEntries)
        .where(eq(textEntries.id, entry.id));
      expect(row).toMatchObject({is_deleted: true, subject: entry.subject});
      await refusedAfterRestore(headers =>
        base.user1Client.request(
          'DELETE',
          `/api/v1/tags/${tag.id}`,
          undefined,
          headers
        )
      );
      // The tag of the name came back in place, and stays.
      const [kept] = await db().select().from(tags).where(eq(tags.id, tag.id));
      expect(kept?.is_deleted).toBe(false);
    });

    it('reorders that name when they were made', async () => {
      const [top, bottom] = await liveTags(base.user1);
      await refusedAfterRestore(headers =>
        base.user1Client.request(
          'POST',
          '/api/v1/tags/reorder',
          {
            data: {
              type: 'Tag',
              attributes: {top: String(bottom?.id), bottom: String(top?.id)},
            },
          },
          headers
        )
      );
      expect((await liveTags(base.user1)).map(row => row.id)).toEqual([
        top?.id,
        bottom?.id,
      ]);
    });

    it('retries of a write first sent before it', async () => {
      const writeId = 'queued-before-restore';
      const send = () =>
        base.user1Client.request(
          'POST',
          '/api/v1/entries',
          {
            data: {
              type: 'TextEntry',
              attributes: {subject: 'retried', body: 'body'},
            },
          },
          {[CLIENT_WRITE_ID_HEADER]: writeId}
        );
      expect((await send()).status).toBe(201);
      await restore(base.user1Client, await backupOf(base.user1Client));
      const response = await send();
      expect(response.status).toBe(400);
      expect((await json(response)).errors[0].code).toBe('data_restored');
    });

    it('but not writes made after it', async () => {
      await restore(base.user1Client, await backupOf(base.user1Client));
      const response = await base.user1Client.request(
        'POST',
        '/api/v1/entries',
        {
          data: {
            type: 'TextEntry',
            attributes: {subject: 'made after', body: 'body'},
          },
        },
        {[CLIENT_UPDATED_HEADER]: new Date().toISOString()}
      );
      expect(response.status).toBe(201);
      expect((await liveEntries(base.user1)).map(row => row.subject)).toContain(
        'made after'
      );
    });
  });

  it("is made as of the API's clock, whatever time the request names", async () => {
    const old = '2020-01-01T00:00:00.000000';
    const response = await base.user1Client.request(
      'POST',
      '/api/v1/user/restore',
      await backupOf(base.user1Client),
      {[CLIENT_UPDATED_HEADER]: old}
    );
    expect(response.status).toBe(200);
    const {date_restored: restored} = restoreResultSchema.parse(
      await json(response)
    );
    expect(restored > old).toBe(true);
    const [user] = await db()
      .select()
      .from(users)
      .where(eq(users.id, base.user1.id));
    expect(user?.date_restored).toBe(restored);
    for (const row of await liveEntries(base.user1)) {
      expect(row.client_updated).toBe(restored);
    }
    // A write made between the time named and the restore changes nothing.
    const [entry] = await liveEntries(base.user1);
    const edit = await base.user1Client.request(
      'PATCH',
      `/api/v1/entries/${entry?.id}`,
      {
        data: {
          type: 'TextEntry',
          id: String(entry?.id),
          attributes: {subject: 'between'},
        },
      },
      {[CLIENT_UPDATED_HEADER]: '2021-01-01T00:00:00'}
    );
    expect(edit.status).toBe(400);
  });

  it('is refused without a session', async () => {
    const backup = await backupOf(base.user1Client);
    const response = await restore(base.unauthenticatedClient, backup);
    expect(response.status).toBe(403);
    expect((await json(response)).errors[0].code).toBe('not_authenticated');
  });

  describe('refuses an invalid backup, changing nothing', () => {
    let backup: Backup;

    beforeEach(async () => {
      const source = await richUser();
      await textEntryReusedFactory({
        text_entry: (await liveEntries(source))[0] as never,
        user: source,
      });
      backup = await backupOf(await clientOf(source));
    });

    const refused = async (body: unknown, pointer: string, detail: RegExp) => {
      const tagsBefore = await liveTags(base.user1);
      const response = await restore(base.user1Client, body);
      expect(response.status).toBe(400);
      const [error] = (await json(response)).errors;
      expect(error.source.pointer).toBe(pointer);
      expect(error.detail).toMatch(detail);
      expect(await liveTags(base.user1)).toEqual(tagsBefore);
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

describe('restored reuses', () => {
  it('count toward the entry they name', async () => {
    const user = await richUser();
    const backup = await backupOf(await clientOf(user));
    const target = await userFactory({}, {examples: false});
    await restore(await clientOf(target), backup);
    const reuses = await db()
      .select()
      .from(entryReuses)
      .where(eq(entryReuses.user_id, target.id));
    expect(reuses).toHaveLength(3);
  });
});
