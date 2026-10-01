import {
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
} from '@commandsnippets/api-shared';
import {eq, sql} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  clientWrites,
  syncClock,
  tagClientIds,
  tags,
  tagsEntries,
  textEntries,
  type User,
} from '../../src/db/schema';
import {formatMicros, nowMicros} from '../../src/lib/clock';
import {
  ApiClient,
  db,
  json,
  refreshEntry,
  refreshJunction,
  refreshTag,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  tokenFor,
} from '../helpers';
import {raceBeforeInsert, raceBeforeStatement} from '../support/races';

// v2: queued (offline) writes name when they were made, and the latest edit
// wins whatever order they arrive in (resources/lww.ts).
const EARLY = '2026-01-01T00:00:00.000000';
const LATER = '2026-01-02T00:00:00.000000';
const LATEST = '2026-01-03T00:00:00.000000';

let user: User;
let other: User;
let client: ApiClient;

beforeEach(async () => {
  ({user1: user, user2: other, user1Client: client} = await setUpBase());
});

const made = (at: string) => ({[CLIENT_UPDATED_HEADER]: at});
const send = (method: string, path: string, at: string, body?: unknown) =>
  client.request(method, `/api/v1${path}`, body, made(at));

const tagRename = (id: number, name: string) => ({
  data: {type: 'Tag', id: String(id), attributes: {name}},
});
const entryEdit = (id: number, attributes: Record<string, unknown>) => ({
  data: {type: 'TextEntry', id: String(id), attributes},
});

describe('a write older than the last one', () => {
  it('changes no tag, and answers with the tag as it stands', async () => {
    const tag = await tagFactory({user, name: 'start'});
    await send('PATCH', `/tags/${tag.id}`, LATER, tagRename(tag.id, 'newer'));

    const stale = await send(
      'PATCH',
      `/tags/${tag.id}`,
      EARLY,
      tagRename(tag.id, 'older')
    );
    expect(stale.status).toBe(200);
    expect((await json(stale)).data.attributes.name).toBe('newer');
    const deleted = await send('DELETE', `/tags/${tag.id}`, EARLY);
    expect((await json(deleted)).data.attributes.is_deleted).toBe(false);
    expect(await refreshTag(tag.id)).toMatchObject({
      name: 'newer',
      is_deleted: false,
      client_updated: LATER,
    });

    // A newer one applies.
    await send('PATCH', `/tags/${tag.id}`, LATEST, tagRename(tag.id, 'newest'));
    expect((await refreshTag(tag.id))?.name).toBe('newest');
  });

  it('never deletes a tag created (again) after it was made', async () => {
    const tag = await tagFactory({user, name: 'kept'});
    await send('POST', '/tags', LATER, {
      data: {type: 'Tag', attributes: {name: 'kept'}},
    });
    const before = await refreshTag(tag.id);
    expect(before?.date_updated).toBe(tag.date_updated);

    await send('DELETE', `/tags/${tag.id}`, EARLY);
    expect((await refreshTag(tag.id))?.is_deleted).toBe(false);
  });

  it('never brings back a tag deleted after it was made', async () => {
    const tag = await tagFactory({user, name: 'gone'});
    await send('DELETE', `/tags/${tag.id}`, LATER);

    const created = await send('POST', '/tags', EARLY, {
      data: {type: 'Tag', attributes: {name: 'gone'}},
    });
    expect(created.status).toBe(201);
    const body = await json(created);
    expect(body.data.id).toBe(String(tag.id));
    expect(body.data.attributes.is_deleted).toBe(true);

    await send('POST', '/tags', LATEST, {
      data: {type: 'Tag', attributes: {name: 'gone'}},
    });
    expect((await refreshTag(tag.id))?.is_deleted).toBe(false);
  });

  it('changes no entry', async () => {
    const entry = await textEntryFactory({user, subject: 'start'});
    await send(
      'PATCH',
      `/entries/${entry.id}`,
      LATER,
      entryEdit(entry.id, {subject: 'newer'})
    );

    const stale = await send(
      'PATCH',
      `/entries/${entry.id}`,
      EARLY,
      entryEdit(entry.id, {subject: 'older', body: 'older'})
    );
    expect((await json(stale)).data.attributes.subject).toBe('newer');
    const deleted = await send('DELETE', `/entries/${entry.id}`, EARLY);
    expect((await json(deleted)).data.attributes.is_deleted).toBe(false);
    expect(await refreshEntry(entry.id)).toMatchObject({
      subject: 'newer',
      body: entry.body,
      is_deleted: false,
    });
  });

  it('neither untags nor tags against a newer one', async () => {
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const junction = await tagTextEntryFactory({tag, text_entry: entry, user});
    const tagging = {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: {type: 'Tag', id: String(tag.id)}},
          text_entry: {data: {type: 'TextEntry', id: String(entry.id)}},
        },
      },
    };
    // Tagged (again) later than an untag made offline.
    await send('POST', '/tags_entries', LATER, tagging);
    const staleUntag = await send(
      'DELETE',
      `/tags_entries/${junction.id}`,
      EARLY
    );
    expect(staleUntag.status).toBe(200);
    expect((await json(staleUntag)).data.attributes.is_deleted).toBe(false);
    expect((await refreshJunction(junction.id))?.is_deleted).toBe(false);

    // Untagged later than a tagging made offline.
    await send('DELETE', `/tags_entries/${junction.id}`, LATEST);
    const staleTag = await send('POST', '/tags_entries', LATER, tagging);
    expect(staleTag.status).toBe(201);
    expect((await json(staleTag)).data.attributes.is_deleted).toBe(true);
    expect((await refreshJunction(junction.id))?.is_deleted).toBe(true);
    expect((await refreshTag(tag.id))?.entry_count).toBe(0);
  });
});

describe('writes arriving out of order', () => {
  const tagging = (tagId: number, entryId: number) => ({
    data: {
      type: 'TagTextEntryThroughModel',
      relationships: {
        tag: {data: {type: 'Tag', id: String(tagId)}},
        text_entry: {data: {type: 'TextEntry', id: String(entryId)}},
      },
    },
  });

  it('keep the latest untag, even of a junction untagged already', async () => {
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const junction = await tagTextEntryFactory({tag, text_entry: entry, user});

    // Untagged at EARLY and at LATEST; a tagging made at LATER arrives last.
    await send('DELETE', `/tags_entries/${junction.id}`, EARLY);
    await send('DELETE', `/tags_entries/${junction.id}`, LATEST);
    const tagged = await send(
      'POST',
      '/tags_entries',
      LATER,
      tagging(tag.id, entry.id)
    );

    expect((await json(tagged)).data.attributes.is_deleted).toBe(true);
    expect(await refreshJunction(junction.id)).toMatchObject({
      is_deleted: true,
      client_updated: LATEST,
    });
  });

  it('never let an older delete landing mid-create win over the create', async () => {
    const tag = await tagFactory({user, name: 'kept'});
    // Just before the create (made LATER) writes the tag, a delete made
    // EARLY lands.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(/^\s*update "tags_tag"/i, async () => {
        await db()
          .update(tags)
          .set({is_deleted: true, client_updated: EARLY})
          .where(eq(tags.id, tag.id));
      })
    );

    const response = await racing.request(
      'POST',
      '/api/v1/tags',
      {data: {type: 'Tag', attributes: {name: 'kept'}}},
      made(LATER)
    );

    expect(response.status).toBe(201);
    expect((await json(response)).data.attributes.is_deleted).toBe(false);
    expect(await refreshTag(tag.id)).toMatchObject({
      is_deleted: false,
      client_updated: LATER,
    });
  });

  it('record a create that lost the race to a concurrent one of the name', async () => {
    // Just before this create (made LATER) inserts, another (made EARLY)
    // creates the tag.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeInsert('tags_tag', async () => {
        const raced = await tagFactory({user, name: 'raced'});
        await db()
          .update(tags)
          .set({client_updated: EARLY})
          .where(eq(tags.id, raced.id));
      })
    );
    const created = await racing.request(
      'POST',
      '/api/v1/tags',
      {data: {type: 'Tag', attributes: {name: 'raced'}}},
      made(LATER)
    );
    expect(created.status).toBe(201);
    const id = (await json(created)).data.id;

    // So a delete made in between (older than this create) loses to it.
    const deleted = await send('DELETE', `/tags/${id}`, '2026-01-01T12:00:00');
    expect((await json(deleted)).data.attributes.is_deleted).toBe(false);
    expect((await refreshTag(Number(id)))?.client_updated).toBe(LATER);
  });

  it('create the name asked for when the tag of it is renamed meanwhile', async () => {
    const tag = await tagFactory({user, name: 'alpha'});
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(/^\s*update "tags_tag"/i, async () => {
        await db().update(tags).set({name: 'beta'}).where(eq(tags.id, tag.id));
      })
    );

    const response = await racing.request(
      'POST',
      '/api/v1/tags',
      {data: {type: 'Tag', attributes: {name: 'alpha'}}},
      made(LATER)
    );

    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body.data.attributes.name).toBe('alpha');
    expect(body.data.id).not.toBe(String(tag.id));
    expect((await refreshTag(tag.id))?.name).toBe('beta');
  });

  it('never let an older untag landing mid-tagging win over the tagging', async () => {
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const junction = await tagTextEntryFactory({tag, text_entry: entry, user});
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(
        /^\s*update "tags_tagtextentrythroughmodel"/i,
        async () => {
          await db()
            .update(tagsEntries)
            .set({is_deleted: true, client_updated: EARLY})
            .where(eq(tagsEntries.id, junction.id));
        }
      )
    );

    const response = await racing.request(
      'POST',
      '/api/v1/tags_entries',
      tagging(tag.id, entry.id),
      made(LATER)
    );

    expect(response.status).toBe(201);
    expect((await json(response)).data.attributes.is_deleted).toBe(false);
    expect(await refreshJunction(junction.id)).toMatchObject({
      is_deleted: false,
      client_updated: LATER,
    });
  });
});

describe("another user's legacy junction between the user's tag and entry", () => {
  it('is taken over by a tagging, whatever its time, and never answered with', async () => {
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const legacy = await tagTextEntryFactory({
      tag,
      text_entry: entry,
      user: other,
      is_deleted: true,
    });
    await db()
      .update(tagsEntries)
      .set({client_updated: LATEST})
      .where(eq(tagsEntries.id, legacy.id));

    const response = await send('POST', '/tags_entries', EARLY, {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: {type: 'Tag', id: String(tag.id)}},
          text_entry: {data: {type: 'TextEntry', id: String(entry.id)}},
        },
      },
    });

    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body.data.relationships.user.data.id).toBe(String(user.id));
    expect(body.data.attributes.is_deleted).toBe(false);
    expect(JSON.stringify(body)).not.toContain(other.username);
    expect(await refreshJunction(legacy.id)).toMatchObject({
      user_id: user.id,
      is_deleted: false,
    });
  });
});

describe('the client time', () => {
  it('counts a write without one as made now', async () => {
    const tag = await tagFactory({user, name: 'start'});
    await send('PATCH', `/tags/${tag.id}`, LATER, tagRename(tag.id, 'queued'));
    const response = await client.patch(
      `/api/v1/tags/${tag.id}`,
      tagRename(tag.id, 'now')
    );
    expect((await json(response)).data.attributes.name).toBe('now');
    expect((await refreshTag(tag.id))?.client_updated ?? '').toMatch(
      /^20\d\d-/
    );
    expect((await refreshTag(tag.id))?.client_updated ?? '').not.toBe(LATER);
  });

  it('counts a time ahead of the clock as now', async () => {
    const entry = await textEntryFactory({user});
    await send(
      'PATCH',
      `/entries/${entry.id}`,
      '2999-01-01T00:00:00',
      entryEdit(entry.id, {subject: 'skewed'})
    );
    const stored = (await refreshEntry(entry.id))?.client_updated ?? '';
    expect(stored < '2999-01-01').toBe(true);

    // So a later edit from a clock that is right still applies.
    await client.patch(
      `/api/v1/entries/${entry.id}`,
      entryEdit(entry.id, {subject: 'later'})
    );
    expect((await refreshEntry(entry.id))?.subject).toBe('later');
  });

  it('refuses one that is not a datetime', async () => {
    const tag = await tagFactory({user, name: 'start'});
    const response = await send(
      'PATCH',
      `/tags/${tag.id}`,
      'yesterday',
      tagRename(tag.id, 'x')
    );
    expect(response.status).toBe(400);
    expect((await refreshTag(tag.id))?.name).toBe('start');
  });
});

describe('a write made ahead of the clock', () => {
  const AHEAD = '2999-01-01T00:00:00.000000';
  const sendOnce = (
    writeId: string,
    method: string,
    path: string,
    body?: unknown
  ) =>
    client.request(method, `/api/v1${path}`, body, {
      ...made(AHEAD),
      [CLIENT_WRITE_ID_HEADER]: writeId,
    });

  it('counts as made when it first arrived on every retry: a write made in between stands', async () => {
    const tag = await tagFactory({user, name: 'start'});
    // Its answer is lost.
    await sendOnce(
      'write-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'ahead')
    );
    expect((await refreshTag(tag.id))?.name).toBe('ahead');
    // Another device's write, after it.
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'between'));

    const retried = await sendOnce(
      'write-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'ahead')
    );
    expect(retried.status).toBe(200);
    expect((await json(retried)).data.attributes.name).toBe('between');
    expect((await refreshTag(tag.id))?.name).toBe('between');

    // A new write (another id) counts as now: it applies.
    await sendOnce(
      'write-2',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'newest')
    );
    expect((await refreshTag(tag.id))?.name).toBe('newest');
  });

  it('as one naming no time: counts as made when it first arrived on every retry', async () => {
    const tag = await tagFactory({user, name: 'start'});
    const untimed = () =>
      client.request(
        'PATCH',
        `/api/v1/tags/${tag.id}`,
        tagRename(tag.id, 'untimed'),
        {[CLIENT_WRITE_ID_HEADER]: 'untimed-1'}
      );
    await untimed();
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'between'));

    expect((await json(await untimed())).data.attributes.name).toBe('between');
    expect((await refreshTag(tag.id))?.name).toBe('between');
  });

  it('as one naming no time or a time ahead, counts as now by the database clock, which every isolate shares', async () => {
    const tag = await tagFactory({user, name: 'start'});
    await sendOnce(
      'ahead-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'ahead')
    );
    const databaseNow = async () =>
      (
        await db().get<{now: string}>(
          sql`SELECT strftime('%Y-%m-%dT%H:%M:%f', 'now') || '000' AS now`
        )
      ).now;
    const stamped = (await refreshTag(tag.id))?.client_updated ?? '';
    expect(stamped <= (await databaseNow())).toBe(true);
    // So a write naming no time, made after it, applies.
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'untimed'));
    expect((await refreshTag(tag.id))?.name).toBe('untimed');
  });

  it('never overwrites a write committed while it was on its way', async () => {
    const tag = await tagFactory({user, name: 'start'});
    // Just before this write (naming no time) updates the tag, another,
    // which arrived after it, does.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(/^\s*update "tags_tag"/i, () =>
        client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'committed'))
      )
    );
    const delayed = await racing.patch(
      `/api/v1/tags/${tag.id}`,
      tagRename(tag.id, 'delayed')
    );
    expect(delayed.status).toBe(200);
    expect((await json(delayed)).data.attributes.name).toBe('committed');
    expect((await refreshTag(tag.id))?.name).toBe('committed');
  });

  it('never overwrites a write committed while it was on its way, though it reads again', async () => {
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const junction = await tagTextEntryFactory({tag, text_entry: entry, user});
    // Just before this untag (naming no time) writes, a tagging of the pair,
    // which arrived after it, records its time.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(/^\s*update "tags_tagtextentrythroughmodel"/i, () =>
        client.post('/api/v1/tags_entries', {
          data: {
            type: 'TagTextEntryThroughModel',
            relationships: {
              tag: {data: {type: 'Tag', id: String(tag.id)}},
              text_entry: {data: {type: 'TextEntry', id: String(entry.id)}},
            },
          },
        })
      )
    );
    const untag = await racing.delete(`/api/v1/tags_entries/${junction.id}`);
    expect(untag.status).toBe(200);
    expect((await json(untag)).data.attributes.is_deleted).toBe(false);
    expect((await refreshJunction(junction.id))?.is_deleted).toBe(false);
  });

  it('counts a retry after a failure as the write did, and applies it', async () => {
    const tag = await tagFactory({user, name: 'start'});
    // Another device's write, made just before.
    await send(
      'PATCH',
      `/tags/${tag.id}`,
      formatMicros(nowMicros() - 1_000_000),
      tagRename(tag.id, 'before')
    );
    // The first attempt is timed, then fails before it writes.
    const failing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(/^\s*update "tags_tag"/i, () =>
        Promise.reject(new Error('D1 is unavailable'))
      )
    );
    const failed = await failing.request(
      'PATCH',
      `/api/v1/tags/${tag.id}`,
      tagRename(tag.id, 'retried'),
      {[CLIENT_WRITE_ID_HEADER]: 'failed-1'}
    );
    expect(failed.status).toBe(500);
    expect((await refreshTag(tag.id))?.name).toBe('before');

    const retried = await client.request(
      'PATCH',
      `/api/v1/tags/${tag.id}`,
      tagRename(tag.id, 'retried'),
      {[CLIENT_WRITE_ID_HEADER]: 'failed-1'}
    );
    expect((await json(retried)).data.attributes.name).toBe('retried');
    expect((await refreshTag(tag.id))?.name).toBe('retried');
  });

  it('counts as made when it first arrived however late its retry, though other writes were made since', async () => {
    const tag = await tagFactory({user, name: 'start'});
    await sendOnce(
      'old-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'old')
    );
    // Its answer is lost; a year passes, with other writes counted as now.
    const yearAgo = formatMicros(nowMicros() - 365 * 24 * 60 * 60 * 1_000_000);
    await db()
      .update(clientWrites)
      .set({date_created: yearAgo})
      .where(eq(clientWrites.write_id, 'old-1'));
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'between'));
    await sendOnce(
      'other-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'between-2')
    );

    const retried = await sendOnce(
      'old-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'old')
    );
    expect((await json(retried)).data.attributes.name).toBe('between-2');
    expect((await refreshTag(tag.id))?.name).toBe('between-2');
  });

  it('never brings back a tag deleted by a request after it', async () => {
    const tag = await tagFactory({user, name: 'kept'});
    // Once this create (naming no time) is timed, before it reads the tag,
    // a delete that arrived after it is made.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(/^\s*select\b.*\bfrom "tags_tag"\s/i, () =>
        client.delete(`/api/v1/tags/${tag.id}`)
      )
    );
    const create = await racing.request(
      'POST',
      '/api/v1/tags',
      {data: {type: 'Tag', attributes: {name: 'kept'}}},
      {[CLIENT_WRITE_ID_HEADER]: 'create-1'}
    );
    expect(create.status).toBe(201);
    expect((await json(create)).data.attributes.is_deleted).toBe(true);
    expect((await refreshTag(tag.id))?.is_deleted).toBe(true);
  });

  it('never tags again an entry untagged by a request after it', async () => {
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const junction = await tagTextEntryFactory({tag, text_entry: entry, user});
    // Likewise an untag, before this tagging reads the junction.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeStatement(
        /^\s*select\b.*\bfrom "tags_tagtextentrythroughmodel"\s/i,
        () => client.delete(`/api/v1/tags_entries/${junction.id}`)
      )
    );
    const tagging = await racing.request(
      'POST',
      '/api/v1/tags_entries',
      {
        data: {
          type: 'TagTextEntryThroughModel',
          relationships: {
            tag: {data: {type: 'Tag', id: String(tag.id)}},
            text_entry: {data: {type: 'TextEntry', id: String(entry.id)}},
          },
        },
      },
      {[CLIENT_WRITE_ID_HEADER]: 'tagging-1'}
    );
    expect(tagging.status).toBe(201);
    expect((await refreshJunction(junction.id))?.is_deleted).toBe(true);
  });

  it('counts a retry as its first attempt was counted, whatever the clock of the isolate it reaches', async () => {
    const tag = await tagFactory({user, name: 'start'});
    const named = (at: string) => ({
      ...made(at),
      [CLIENT_WRITE_ID_HEADER]: 'past-1',
    });
    // Made just before it arrived: counted at its own time. Its answer is
    // lost.
    const madeAt = formatMicros(nowMicros() - 1000);
    await client.request(
      'PATCH',
      `/api/v1/tags/${tag.id}`,
      tagRename(tag.id, 'first'),
      named(madeAt)
    );
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'between'));

    // The retry reaches an isolate whose clock trails the first one's: to
    // it, the write's time is ahead (as the time sent here is to this one).
    const retried = await client.request(
      'PATCH',
      `/api/v1/tags/${tag.id}`,
      tagRename(tag.id, 'first'),
      named(AHEAD)
    );
    expect((await json(retried)).data.attributes.name).toBe('between');
    expect((await refreshTag(tag.id))?.name).toBe('between');
  });

  it('never shares a time with another write: an old retry never ties an edit made in between', async () => {
    const tag = await tagFactory({user, name: 'start'});
    // The write clock an hour ahead of the database's: each write is timed
    // a microsecond after the last, within the same millisecond too.
    const ahead = nowMicros() + 3_600_000_000;
    await db()
      .insert(syncClock)
      .values({id: 1, micros: ahead})
      .onConflictDoUpdate({target: syncClock.id, set: {micros: ahead}});
    await sendOnce(
      'tied-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'first')
    );
    expect((await refreshTag(tag.id))?.client_updated).toBe(
      formatMicros(ahead + 1)
    );
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'between'));
    expect((await refreshTag(tag.id))?.client_updated).toBe(
      formatMicros(ahead + 2)
    );

    const retried = await sendOnce(
      'tied-1',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'first')
    );
    expect((await json(retried)).data.attributes.name).toBe('between');
  });

  it("counts each user's write ids apart", async () => {
    const tag = await tagFactory({user, name: 'mine'});
    const theirs = await tagFactory({user: other, name: 'theirs'});
    await sendOnce(
      'shared-id',
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'mine-2')
    );
    await client.patch(`/api/v1/tags/${tag.id}`, tagRename(tag.id, 'mine-3'));
    const otherClient = new ApiClient(await tokenFor(other.id));
    // Their own write after the first counted, which theirs must beat.
    await otherClient.patch(
      `/api/v1/tags/${theirs.id}`,
      tagRename(theirs.id, 'theirs-1')
    );
    await otherClient.request(
      'PATCH',
      `/api/v1/tags/${theirs.id}`,
      tagRename(theirs.id, 'theirs-2'),
      {...made(AHEAD), [CLIENT_WRITE_ID_HEADER]: 'shared-id'}
    );
    expect((await refreshTag(theirs.id))?.name).toBe('theirs-2');
  });

  it('refuses a write id longer than 64 characters', async () => {
    const tag = await tagFactory({user, name: 'start'});
    const response = await sendOnce(
      'x'.repeat(65),
      'PATCH',
      `/tags/${tag.id}`,
      tagRename(tag.id, 'long')
    );
    expect(response.status).toBe(400);
    expect((await refreshTag(tag.id))?.name).toBe('start');
  });
});

describe('an entry created with a client id', () => {
  const create = (clientId: string, subject: string, by = client) =>
    by.post('/api/v1/entries', {
      data: {
        type: 'TextEntry',
        attributes: {subject, body: 'b', client_id: clientId},
      },
    });

  it('is made once, however often the create is retried', async () => {
    const first = await create('local-abc', 'once');
    expect(first.status).toBe(201);
    const made = await json(first);
    expect(made.data.attributes.client_id).toBe('local-abc');
    const retried = await create('local-abc', 'once');
    expect(retried.status).toBe(201);
    expect((await json(retried)).data.id).toBe(made.data.id);
    const rows = await db()
      .select()
      .from(textEntries)
      .where(eq(textEntries.user_id, user.id));
    expect(rows.filter(row => row.subject === 'once')).toHaveLength(1);
  });

  it("is each user's own", async () => {
    const mine = await json(await create('local-same', 'mine'));
    const theirs = await json(
      await create(
        'local-same',
        'theirs',
        new ApiClient(await tokenFor(other.id))
      )
    );
    expect(theirs.data.id).not.toBe(mine.data.id);
    expect(theirs.data.attributes.subject).toBe('theirs');
  });
});

describe('a tag created with a client id', () => {
  const create = (clientId: string, name: string, by = client) =>
    by.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name, client_id: clientId}},
    });
  const userTags = () =>
    db().select().from(tags).where(eq(tags.user_id, user.id));

  it('is made once, whatever it is called by the time the create is retried', async () => {
    const first = await json(await create('local-tag', 'first-name'));
    expect(first.data.attributes.client_id).toBe('local-tag');
    await client.patch(
      `/api/v1/tags/${first.data.id}`,
      tagRename(Number(first.data.id), 'renamed')
    );

    const retried = await create('local-tag', 'first-name');
    expect(retried.status).toBe(201);
    const answer = await json(retried);
    expect(answer.data.id).toBe(first.data.id);
    expect(answer.data.attributes.name).toBe('renamed');
    const names = (await userTags()).map(row => row.name);
    expect(names).toContain('renamed');
    expect(names).not.toContain('first-name');
  });

  it('is not brought back by its retried create once deleted', async () => {
    const first = await json(await create('local-gone', 'gone'));
    await client.delete(`/api/v1/tags/${first.data.id}`);

    const retried = await json(await create('local-gone', 'gone'));
    expect(retried.data.id).toBe(first.data.id);
    expect(retried.data.attributes.is_deleted).toBe(true);
  });

  it("is each user's own", async () => {
    const mine = await json(await create('local-same', 'mine'));
    const theirs = await json(
      await create(
        'local-same',
        'theirs',
        new ApiClient(await tokenFor(other.id))
      )
    );
    expect(theirs.data.id).not.toBe(mine.data.id);
    expect(theirs.data.attributes.name).toBe('theirs');
  });

  it('is found by a retry after it answered with the tag of the name', async () => {
    // Made by another create, and by none.
    const first = await json(await create('local-first', 'shared'));
    const plain = await tagFactory({user, name: 'plain'});
    for (const [id, name, clientId] of [
      [first.data.id, 'shared', 'local-second'],
      [String(plain.id), 'plain', 'local-plain'],
    ]) {
      const answer = await json(await create(clientId, name));
      expect(answer.data.id).toBe(id);
      await client.patch(
        `/api/v1/tags/${id}`,
        tagRename(Number(id), `${name}-moved`)
      );

      const retried = await json(await create(clientId, name));
      expect(retried.data.id).toBe(id);
      expect(retried.data.attributes.name).toBe(`${name}-moved`);
    }
    const names = (await userTags()).map(row => row.name);
    expect(names).not.toContain('shared');
    expect(names).not.toContain('plain');
    // The tag renders the id of the create that made it.
    expect(first.data.attributes.client_id).toBe('local-first');
    expect((await refreshTag(plain.id))?.client_id).toBeNull();
  });

  it('is found by a retry after a newer write to the tag of the name won', async () => {
    const tag = await tagFactory({user, name: 'newer'});
    await send('PATCH', `/tags/${tag.id}`, LATER, tagRename(tag.id, 'newer'));
    const createEarly = () =>
      send('POST', '/tags', EARLY, {
        data: {
          type: 'Tag',
          attributes: {name: 'newer', client_id: 'local-old'},
        },
      });
    expect((await json(await createEarly())).data.id).toBe(String(tag.id));
    await send('PATCH', `/tags/${tag.id}`, LATEST, tagRename(tag.id, 'gone'));

    expect((await json(await createEarly())).data.id).toBe(String(tag.id));
    expect((await userTags()).map(row => row.name)).not.toContain('newer');
  });

  it('answers a retry racing the create with the tag the create made', async () => {
    // Just before this create inserts, its earlier attempt (whose answer was
    // lost) makes the tag, under another name by now.
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeInsert('tags_tag', () =>
        create('local-raced', 'raced').then(async made => {
          const {data} = await json(made);
          await client.patch(
            `/api/v1/tags/${data.id}`,
            tagRename(Number(data.id), 'renamed')
          );
        })
      )
    );
    const response = await create('local-raced', 'raced', racing);
    expect(response.status).toBe(201);
    expect((await json(response)).data.attributes.name).toBe('renamed');
    expect((await userTags()).map(row => row.name)).not.toContain('raced');
  });

  it('answers a retry racing an answer with the tag of the name with that tag', async () => {
    // Just before this create (of a name no tag has) inserts, its earlier
    // attempt is answered with the user's tag of another name it had then,
    // renamed since: the client id names that tag, and no other is made.
    const tag = await tagFactory({user, name: 'had'});
    const racing = new ApiClient(
      await tokenFor(user.id),
      raceBeforeInsert('tags_tag', async () => {
        await create('local-alias', 'had');
        await client.patch(
          `/api/v1/tags/${tag.id}`,
          tagRename(tag.id, 'elsewhere')
        );
      })
    );
    const response = await create('local-alias', 'fresh', racing);
    expect(response.status).toBe(201);
    expect((await json(response)).data.id).toBe(String(tag.id));
    expect((await userTags()).map(row => row.name)).not.toContain('fresh');
    expect(
      (await db().select().from(tagClientIds)).filter(
        row => row.client_id === 'local-alias'
      )
    ).toEqual([expect.objectContaining({tag_id: tag.id, user_id: user.id})]);
  });

  it('refuses a client id longer than 64 characters', async () => {
    const response = await create('x'.repeat(65), 'long');
    expect(response.status).toBe(400);
    expect((await userTags()).map(row => row.name)).not.toContain('long');
  });
});
