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
      raceBeforeInsert('tags_tag', async () => {
        await tagFactory({user, name: 'renamed', client_id: 'local-raced'});
      })
    );
    const response = await create('local-raced', 'raced', racing);
    expect(response.status).toBe(201);
    expect((await json(response)).data.attributes.name).toBe('renamed');
    expect((await userTags()).map(row => row.name)).not.toContain('raced');
  });

  it('refuses a client id longer than 64 characters', async () => {
    const response = await create('x'.repeat(65), 'long');
    expect(response.status).toBe(400);
    expect((await userTags()).map(row => row.name)).not.toContain('long');
  });
});
