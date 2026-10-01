/**
 * What the web client's sync reads: keyset pages in revision order
 * (`page[after]`), and a tag's junctions (`GET /tags_entries`), deleted ones
 * too, as the tag's changes since a cursor.
 */
import {CURSOR_START} from '@commandsnippets/api-shared';
import {eq, inArray} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {
  type Tag,
  type TagTextEntry,
  type TextEntry,
  tagsEntries,
  textEntries,
  type User,
} from '../../src/db/schema';
import {
  ApiClient,
  db,
  isoformat,
  type Json,
  json,
  raceBeforeStatement,
  refreshEntry,
  refreshJunction,
  refreshTag,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  tokenFor,
} from '../helpers';

/** Every page of `path` from `after`, one keyset page at a time. */
async function readAll(
  client: ApiClient,
  path: string,
  after = CURSOR_START,
  size = 2
): Promise<{ids: string[]; cursor: string}> {
  const ids: string[] = [];
  let cursor = after;
  let next: string | null =
    `${path}${path.includes('?') ? '&' : '?'}page[after]=${encodeURIComponent(cursor)}&page[size]=${size}`;
  while (next !== null) {
    const response = await client.get(next.replace(/^https?:\/\/[^/]+/, ''));
    expect(response.status).toBe(200);
    const body = await json(response);
    for (const row of body.data) {
      ids.push(row.id);
      cursor = `${row.attributes.date_updated},${row.id}`;
    }
    next = body.links.next;
  }
  return {ids, cursor};
}

/** Give entries `ids` one revision, as a single statement's write does. */
async function stampAlike(ids: number[], revision: string): Promise<void> {
  await db()
    .update(textEntries)
    .set({date_updated: revision})
    .where(inArray(textEntries.id, ids));
}

const tagPayload = (tag: Tag, entry: TextEntry) => ({
  data: {
    type: 'TagTextEntryThroughModel',
    relationships: {
      tag: {data: {type: 'Tag', id: String(tag.id)}},
      text_entry: {data: {type: 'TextEntry', id: String(entry.id)}},
    },
  },
});

/** The ids of tag `tag`'s junctions listed after `cursor`, with their state. */
async function tagChanges(
  client: ApiClient,
  tag: Tag,
  cursor = CURSOR_START
): Promise<{rows: Json[]; cursor: string}> {
  const {ids, cursor: last} = await readAll(
    client,
    `/api/v1/tags_entries?filter[tag.id]=${tag.id}`,
    cursor
  );
  const rows = await Promise.all(
    ids.map(async id => refreshJunction(Number(id)))
  );
  return {rows, cursor: last};
}

async function setUpTagged(): Promise<{
  user1: User;
  user2: User;
  client: ApiClient;
  tag: Tag;
  entry: TextEntry;
  junction: TagTextEntry;
}> {
  const {user1, user2, user1Client} = await setUpBase();
  const tag = await tagFactory({user: user1});
  const entry = await textEntryFactory({user: user1});
  const junction = await tagTextEntryFactory({
    tag,
    text_entry: entry,
    user: user1,
  });
  return {user1, user2, client: user1Client, tag, entry, junction};
}

describe('keyset pages', () => {
  it('list every row once, in revision order, across split revisions', async () => {
    const {user1, user1Client} = await setUpBase();
    const created: TextEntry[] = [];
    for (let i = 0; i < 5; i++) {
      created.push(await textEntryFactory({user: user1}));
    }
    // Three rows one write stamped alike, which a page boundary splits.
    const alike = created.slice(1, 4).map(entry => entry.id);
    await stampAlike(alike, '2030-01-01T00:00:00.000000');

    const {ids} = await readAll(user1Client, '/api/v1/entries');
    const all = (
      await db()
        .select()
        .from(textEntries)
        .where(eq(textEntries.user_id, user1.id))
    )
      .sort((a, b) =>
        a.date_updated === b.date_updated
          ? a.id - b.id
          : a.date_updated < b.date_updated
            ? -1
            : 1
      )
      .map(entry => String(entry.id));
    expect(ids).toEqual(all);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('pick up a row that changed behind the cursor, and skip none', async () => {
    const {user1, user1Client} = await setUpBase();
    const [first, second, third] = [
      await textEntryFactory({user: user1}),
      await textEntryFactory({user: user1}),
      await textEntryFactory({user: user1}),
    ] as [TextEntry, TextEntry, TextEntry];
    const firstPage = await json(
      await user1Client.get(
        `/api/v1/entries?filter[id]=${first.id}&page[after]=${CURSOR_START}`
      )
    );
    const cursor = `${firstPage.data[0].attributes.date_updated},${first.id}`;
    // An edit: its revision moves past every row, so a later page lists it.
    await user1Client.patch(`/api/v1/entries/${first.id}`, {
      data: {type: 'TextEntry', id: String(first.id), attributes: {body: 'x'}},
    });
    const {ids} = await readAll(user1Client, '/api/v1/entries', cursor);
    expect(ids.slice(-1)).toEqual([String(first.id)]);
    expect(ids).toEqual(
      expect.arrayContaining([second, third].map(e => String(e.id)))
    );
  });

  it('link the next page only while rows are left, and honor filters', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const tagged = await textEntryFactory({user: user1});
    await tagTextEntryFactory({tag, text_entry: tagged, user: user1});
    await textEntryFactory({user: user1});
    const body = await json(
      await user1Client.get(
        `/api/v1/entries?filter[tags.id]=${tag.id}&page[after]=${CURSOR_START}&page[size]=1`
      )
    );
    expect(body.data.map((entry: Json) => entry.id)).toEqual([
      String(tagged.id),
    ]);
    expect(body.links).toEqual({next: null});
    expect(body).not.toHaveProperty('meta');
  });

  it('are refused alongside a page number or a sort', async () => {
    const {user1Client} = await setUpBase();
    for (const query of [
      `page[after]=${CURSOR_START}&page[number]=1`,
      `page[after]=${CURSOR_START}&sort=-date_updated`,
    ]) {
      expect((await user1Client.get(`/api/v1/tags?${query}`)).status).toBe(400);
    }
  });
});

describe('the junction list', () => {
  it("lists only the requester's junctions", async () => {
    const {user1, user2, client, junction} = await setUpTagged();
    const theirs = await tagTextEntryFactory({
      tag: await tagFactory({user: user2}),
      text_entry: await textEntryFactory({user: user2}),
      user: user2,
    });
    const body = await json(await client.get('/api/v1/tags_entries'));
    const ids = body.data.map((row: Json) => row.id);
    expect(ids).toContain(String(junction.id));
    expect(ids).not.toContain(String(theirs.id));
    const own = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.user_id, user1.id));
    expect(body.meta.pagination.count).toBe(own.length);
  });

  it('filters by tag, entry and deletion', async () => {
    const {user1, client, tag, entry, junction} = await setUpTagged();
    const deleted = await tagTextEntryFactory({
      tag: await tagFactory({user: user1}),
      text_entry: entry,
      user: user1,
      is_deleted: true,
    });
    const ids = async (query: string) =>
      (await json(await client.get(`/api/v1/tags_entries?${query}`))).data.map(
        (row: Json) => row.id
      );
    expect(await ids(`filter[tag.id]=${tag.id}`)).toEqual([
      String(junction.id),
    ]);
    expect(await ids(`filter[text_entry.id]=${entry.id}`)).toEqual(
      [junction, deleted].map(row => String(row.id))
    );
    expect(await ids('filter[is_deleted]=true')).toEqual([String(deleted.id)]);
    const included = await json(
      await client.get(
        `/api/v1/tags_entries?filter[tag.id]=${tag.id}&include=text_entry`
      )
    );
    expect(included.included.map((row: Json) => row.id)).toEqual([
      String(entry.id),
    ]);
  });
});

describe('the junction list, numbered', () => {
  it('lists the newest first on request, and those changed since a revision', async () => {
    const {user1, client, entry, junction} = await setUpTagged();
    const newer = await tagTextEntryFactory({
      tag: await tagFactory({user: user1}),
      text_entry: entry,
      user: user1,
    });
    await db()
      .update(tagsEntries)
      .set({date_updated: '2031-01-01T00:00:00.000000'})
      .where(eq(tagsEntries.id, newer.id));
    // The client's mark: the newest junction revision there is.
    const newest = await json(
      await client.get('/api/v1/tags_entries?sort=-date_updated&page[size]=1')
    );
    expect(newest.data.map((row: Json) => row.id)).toEqual([String(newer.id)]);
    expect(newest.data[0].attributes.date_updated).toBe('2031-01-01T00:00:00');

    const since = await json(
      await client.get(
        `/api/v1/tags_entries?filter[date_updated.gt]=${encodeURIComponent('2030-01-01T00:00:00')}`
      )
    );
    expect(since.data.map((row: Json) => row.id)).toEqual([String(newer.id)]);
    expect(junction.id).not.toBe(newer.id);
  });
});

describe('untagging soft-deletes the junction', () => {
  it('flags it, moves the counters, and advances the tag and entry', async () => {
    const {client, tag, entry, junction} = await setUpTagged();
    const before = {
      tag: await refreshTag(tag.id),
      entry: await refreshEntry(entry.id),
    };
    expect(before.tag?.entry_count).toBe(1);
    expect(before.entry?.tag_count).toBe(1);

    const response = await client.delete(`/api/v1/tags_entries/${junction.id}`);
    expect(response.status).toBe(200);

    const deleted = await refreshJunction(junction.id);
    const after = {
      tag: await refreshTag(tag.id),
      entry: await refreshEntry(entry.id),
    };
    expect(deleted?.is_deleted).toBe(true);
    expect(deleted && deleted.date_updated > junction.date_updated).toBe(true);
    expect(after.tag?.entry_count).toBe(0);
    expect(after.entry?.tag_count).toBe(0);
    // No junction left in the tag: it was last used never.
    expect(after.tag?.date_last_used).toBeNull();
    expect(
      after.tag !== undefined &&
        before.tag !== undefined &&
        after.tag.date_updated > before.tag.date_updated
    ).toBe(true);
    expect(
      after.entry !== undefined &&
        before.entry !== undefined &&
        after.entry.date_updated > before.entry.date_updated
    ).toBe(true);

    // Gone from the entry's tags, and from the tag's entries.
    const listed = await json(await client.get(`/api/v1/entries/${entry.id}`));
    expect(listed.data.relationships.text_entry_to_tag).toEqual({
      data: [],
      meta: {count: 0},
    });
    const inTag = await json(
      await client.get(`/api/v1/entries?filter[tags.id]=${tag.id}`)
    );
    expect(inTag.data).toEqual([]);
    // Untagging again (a retried untag) changes nothing a client syncs (only
    // the time of the last write): answered alike.
    const again = await client.delete(`/api/v1/tags_entries/${junction.id}`);
    expect(again.status).toBe(200);
    expect((await json(again)).data.attributes.is_deleted).toBe(true);
    expect(await refreshJunction(junction.id)).toEqual({
      ...deleted,
      client_updated: expect.any(String),
    });
    expect((await refreshTag(tag.id))?.entry_count).toBe(0);
  });

  it('never counts a deleted junction, inserted or removed', async () => {
    const {user1, tag, entry} = await setUpTagged();
    const counts = async () => [
      (await refreshTag(tag.id))?.entry_count,
      (await refreshEntry(entry.id))?.tag_count,
    ];
    const before = await counts();
    const deleted = await tagTextEntryFactory({
      tag,
      text_entry: await textEntryFactory({user: user1}),
      user: user1,
      is_deleted: true,
    });
    expect((await refreshTag(tag.id))?.entry_count).toBe(before[0]);
    // Only a cascade removes junctions; a deleted one was out already.
    await db().delete(tagsEntries).where(eq(tagsEntries.id, deleted.id));
    expect(await counts()).toEqual(before);
  });

  it('tagging the pair again restores it, at the bottom of the tag', async () => {
    const {user1, client, tag, entry, junction} = await setUpTagged();
    const later = await tagTextEntryFactory({
      tag,
      text_entry: await textEntryFactory({user: user1}),
      user: user1,
      order: 5,
    });
    await client.delete(`/api/v1/tags_entries/${junction.id}`);
    const response = await client.post(
      '/api/v1/tags_entries',
      tagPayload(tag, entry)
    );
    expect(response.status).toBe(201);
    const body = await json(response);
    expect(body.data.id).toBe(String(junction.id));
    expect(body.data.attributes.is_deleted).toBe(false);
    expect(body.data.attributes.order).toBe(later.order + 1);
    expect((await refreshTag(tag.id))?.entry_count).toBe(2);
    expect((await refreshEntry(entry.id))?.tag_count).toBe(1);
  });

  it("takes over and restores another user's deleted legacy junction", async () => {
    const {user1, user2, client} = await setUpTagged();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    // Legacy data: user2's junction between user1's tag and entry, deleted.
    const legacy = await tagTextEntryFactory({
      tag,
      text_entry: entry,
      user: user2,
      is_deleted: true,
    });
    const response = await client.post(
      '/api/v1/tags_entries',
      tagPayload(tag, entry)
    );
    expect(response.status).toBe(201);
    expect(await refreshJunction(legacy.id)).toMatchObject({
      user_id: user1.id,
      is_deleted: false,
    });
    expect((await refreshTag(tag.id))?.entry_count).toBe(1);
  });

  it('recomputes date_last_used from the junctions left in the tag', async () => {
    const {user1, client, tag, junction} = await setUpTagged();
    const kept = await tagTextEntryFactory({
      tag,
      text_entry: await textEntryFactory({user: user1}),
      user: user1,
      order: 1,
    });
    await db()
      .update(tagsEntries)
      .set({date_created: '2020-01-01T00:00:00.000000'})
      .where(eq(tagsEntries.id, kept.id));
    await db()
      .update(tagsEntries)
      .set({date_created: '2030-01-01T00:00:00.000000'})
      .where(eq(tagsEntries.id, junction.id));
    await client.delete(`/api/v1/tags_entries/${junction.id}`);
    expect((await refreshTag(tag.id))?.date_last_used).toBe(
      '2020-01-01T00:00:00.000000'
    );
  });

  it('restoring answers with the junction a concurrent request restored', async () => {
    const {user1, client, tag, entry, junction} = await setUpTagged();
    await client.delete(`/api/v1/tags_entries/${junction.id}`);
    const racing = new ApiClient(
      await tokenFor(user1.id),
      raceBeforeStatement(/^\s*update "tags_tagtextentrythroughmodel"/i, () =>
        db()
          .update(tagsEntries)
          .set({is_deleted: false})
          .where(eq(tagsEntries.id, junction.id))
      )
    );
    const response = await racing.post(
      '/api/v1/tags_entries',
      tagPayload(tag, entry)
    );
    expect(response.status).toBe(201);
    expect((await json(response)).data).toMatchObject({
      id: String(junction.id),
      attributes: {is_deleted: false},
    });
  });

  it('restoring a junction a concurrent request removed is a conflict', async () => {
    const {user1, client, tag, entry, junction} = await setUpTagged();
    await client.delete(`/api/v1/tags_entries/${junction.id}`);
    const racing = new ApiClient(
      await tokenFor(user1.id),
      raceBeforeStatement(/^\s*update "tags_tagtextentrythroughmodel"/i, () =>
        db().delete(tagsEntries).where(eq(tagsEntries.id, junction.id))
      )
    );
    const response = await racing.post(
      '/api/v1/tags_entries',
      tagPayload(tag, entry)
    );
    expect(response.status).toBe(409);
    expect((await json(response)).errors[0].code).toBe('conflict');
  });

  it('keeps a deleted junction out of reorders', async () => {
    const {user1, user1Client: client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const ranked: TagTextEntry[] = [];
    for (const order of [0, 1, 2]) {
      ranked.push(
        await tagTextEntryFactory({
          tag,
          text_entry: await textEntryFactory({user: user1}),
          user: user1,
          order,
        })
      );
    }
    const [first, middle, last] = ranked as [
      TagTextEntry,
      TagTextEntry,
      TagTextEntry,
    ];
    await client.delete(`/api/v1/tags_entries/${middle.id}`);
    const deleted = await refreshJunction(middle.id);
    const reorder = (top: number, bottom: number) =>
      client.post('/api/v1/tags_entries/reorder', {
        data: {type: 'TagTextEntryThroughModel', attributes: {top, bottom}},
      });
    // Not a row of the order any more.
    expect((await reorder(middle.id, first.id)).status).toBe(400);
    expect((await reorder(first.id, middle.id)).status).toBe(400);
    // `first` is already just above `last` among the rows in the order.
    expect((await reorder(first.id, last.id)).status).toBe(200);
    expect((await refreshJunction(first.id))?.order).toBe(0);
    // Moving `last` to the top shifts `first`, never the deleted junction.
    expect((await reorder(last.id, first.id)).status).toBe(200);
    expect((await refreshJunction(last.id))?.order).toBe(0);
    expect((await refreshJunction(first.id))?.order).toBe(1);
    expect(await refreshJunction(middle.id)).toEqual(deleted);
  });
});

describe('a reorder racing an untagging', () => {
  /** A tag ranking three live junctions: 0, 1, 2. */
  async function setUpRanked() {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const ranked: TagTextEntry[] = [];
    for (const order of [0, 1, 2]) {
      ranked.push(
        await tagTextEntryFactory({
          tag,
          text_entry: await textEntryFactory({user: user1}),
          user: user1,
          order,
        })
      );
    }
    return {
      user1,
      ranked: ranked as [TagTextEntry, TagTextEntry, TagTextEntry],
    };
  }

  /** A client whose move runs just after `junction` is soft-deleted. */
  const racingDeletion = async (userId: number, junction: TagTextEntry) =>
    new ApiClient(
      await tokenFor(userId),
      raceBeforeStatement(
        /^\s*update "tags_tagtextentrythroughmodel"\s+set "order"/i,
        () =>
          db()
            .update(tagsEntries)
            .set({is_deleted: true})
            .where(eq(tagsEntries.id, junction.id))
      )
    );

  const reorder = (client: ApiClient, top: number, bottom: number) =>
    client.post('/api/v1/tags_entries/reorder', {
      data: {type: 'TagTextEntryThroughModel', attributes: {top, bottom}},
    });

  const ranks = async (rows: TagTextEntry[]) =>
    Promise.all(rows.map(async row => (await refreshJunction(row.id))?.order));

  it('never shifts the live rows around a mover deleted meanwhile', async () => {
    const {user1, ranked} = await setUpRanked();
    const [first, , last] = ranked;
    const client = await racingDeletion(user1.id, last);
    // `last` above `first`: it is gone by the time the move runs.
    expect((await reorder(client, last.id, first.id)).status).toBe(404);
    expect(await ranks(ranked)).toEqual([0, 1, 2]);
  });

  it('never moves next to a reference deleted meanwhile', async () => {
    const {user1, ranked} = await setUpRanked();
    const [first, , last] = ranked;
    const client = await racingDeletion(user1.id, first);
    expect((await reorder(client, last.id, first.id)).status).toBe(404);
    expect(await ranks(ranked)).toEqual([0, 1, 2]);
  });
});

describe("a tag's junctions after a cursor are its changes", () => {
  it('list joins, edits, re-ranks and departures, and nothing else', async () => {
    const {user1, client, tag, entry, junction} = await setUpTagged();
    const other = await tagFactory({user: user1});
    const elsewhere = await tagTextEntryFactory({
      tag: other,
      text_entry: await textEntryFactory({user: user1}),
      user: user1,
    });
    let {rows, cursor} = await tagChanges(client, tag);
    expect(rows.map(row => row.id)).toEqual([junction.id]);

    // An edit of the entry advances its junction in the tag.
    await client.patch(`/api/v1/entries/${entry.id}`, {
      data: {type: 'TextEntry', id: String(entry.id), attributes: {body: 'y'}},
    });
    ({rows, cursor} = await tagChanges(client, tag, cursor));
    expect(rows.map(row => [row.id, row.is_deleted])).toEqual([
      [junction.id, false],
    ]);

    // A join.
    const joining = await textEntryFactory({user: user1});
    const joined = await json(
      await client.post('/api/v1/tags_entries', tagPayload(tag, joining))
    );
    ({rows, cursor} = await tagChanges(client, tag, cursor));
    expect(rows.map(row => row.id)).toEqual([Number(joined.data.id)]);

    // A re-rank: both junctions it shifts.
    await client.post('/api/v1/tags_entries/reorder', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {top: Number(joined.data.id), bottom: junction.id},
      },
    });
    ({rows, cursor} = await tagChanges(client, tag, cursor));
    expect(rows.map(row => row.id).sort()).toEqual(
      [junction.id, Number(joined.data.id)].sort()
    );

    // A departure, as a deleted junction.
    await client.delete(`/api/v1/tags_entries/${junction.id}`);
    ({rows, cursor} = await tagChanges(client, tag, cursor));
    expect(rows.map(row => [row.id, row.is_deleted])).toEqual([
      [junction.id, true],
    ]);

    // Nothing in another tag, and an edit of an entry that left the tag
    // does not reach its deleted junction.
    await client.patch(`/api/v1/entries/${entry.id}`, {
      data: {type: 'TextEntry', id: String(entry.id), attributes: {body: 'z'}},
    });
    await client.patch(`/api/v1/entries/${elsewhere.text_entry_id}`, {
      data: {
        type: 'TextEntry',
        id: String(elsewhere.text_entry_id),
        attributes: {body: 'w'},
      },
    });
    ({rows} = await tagChanges(client, tag, cursor));
    expect(rows).toEqual([]);
  });

  it('advance the junctions of an edited entry to one revision', async () => {
    const {user1, client, entry, junction} = await setUpTagged();
    const second = await tagTextEntryFactory({
      tag: await tagFactory({user: user1}),
      text_entry: entry,
      user: user1,
    });
    await client.patch(`/api/v1/entries/${entry.id}`, {
      data: {type: 'TextEntry', id: String(entry.id), attributes: {body: 'v'}},
    });
    const [a, b] = [
      await refreshJunction(junction.id),
      await refreshJunction(second.id),
    ];
    expect(a?.date_updated).toBe(b?.date_updated);
    expect(a && a.date_updated > junction.date_updated).toBe(true);
    expect(isoformat(a?.date_updated ?? '')).toMatch(/^\d{4}-/);
  });
});
