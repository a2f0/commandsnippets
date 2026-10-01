import {CLIENT_UPDATED_HEADER} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {tags, tagsEntries, textEntries, type User} from '../../src/db/schema';
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
import {raceBeforeStatement} from '../support/races';

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
    const retried = await create('local-abc', 'once');
    expect(retried.status).toBe(201);
    expect((await json(retried)).data.id).toBe((await json(first)).data.id);
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
