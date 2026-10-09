import {eq} from 'drizzle-orm';
import {describe, expect, it} from 'vitest';
import {
  type Tag,
  type TextEntry,
  tags,
  tagsEntries,
  type User,
} from '../../src/db/schema';
import {
  type ApiClient,
  db,
  json,
  refreshTag,
  setUpBase,
  tagFactory,
  tagsOf,
  tagTextEntryFactory,
  textEntryFactory,
} from '../helpers';

const FIXED_WIDTH = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;

const revisionOf = async (tag: Tag) =>
  (await refreshTag(tag.id))?.date_updated ?? '';

/** The latest revision among `user`'s tags: where a tags sync is up to. */
const latest = async (user: User) =>
  (await tagsOf(user))
    .map(tag => tag.date_updated)
    .sort()
    .at(-1) ?? '';

/** The ids of the tags a tags sync from revision `since` lists. */
async function syncFrom(client: ApiClient, since: string): Promise<number[]> {
  const body = await json(
    await client.get(
      `/api/v1/tags?filter[date_updated.gt]=${encodeURIComponent(since)}`
    )
  );
  return body.data.map((tag: {id: string}) => Number(tag.id)).sort();
}

const ids = (...rows: Tag[]) => rows.map(row => row.id).sort();

const tagging = (tagId: number, entryId: number) => ({
  data: {
    type: 'TagTextEntryThroughModel',
    attributes: {},
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
    },
  },
});

const edit = (entry: TextEntry, body: string) => ({
  data: {type: 'TextEntry', id: String(entry.id), attributes: {body}},
});

// Clients sync a tag's entries (`/entries?filter[tags.id]=...`) only when the
// tag's revision, from the tags sync, moved past the one they synced it at.
// So a tag advances whenever anything that sync returns changes
// (migrations/0008_tag_revisions.sql).
describe('tag revisions follow their entries', () => {
  /** user1's entry in tags a and b (not c). */
  async function tagged() {
    const base = await setUpBase();
    const {user1} = base;
    const [a, b, c] = [
      await tagFactory({user: user1}),
      await tagFactory({user: user1}),
      await tagFactory({user: user1}),
    ];
    const entry = await textEntryFactory({user: user1});
    await tagTextEntryFactory({tag: a, text_entry: entry, user: user1});
    await tagTextEntryFactory({tag: b, text_entry: entry, user: user1});
    return {...base, a, b, c, entry};
  }

  it('editing an entry advances its tags, and only those', async () => {
    const {user1, user1Client, a, b, c, entry} = await tagged();
    const [before, cBefore] = [await latest(user1), await revisionOf(c)];
    const response = await user1Client.patch(
      `/api/v1/entries/${entry.id}`,
      edit(entry, 'edited')
    );
    expect(response.status).toBe(200);

    const [aAfter, bAfter] = [await revisionOf(a), await revisionOf(b)];
    expect(aAfter).toMatch(FIXED_WIDTH);
    expect(aAfter > before).toBe(true);
    // One statement's change: every tag it advances gets the same revision.
    expect(bAfter).toBe(aAfter);
    expect(await revisionOf(c)).toBe(cBefore);
    expect(await syncFrom(user1Client, before)).toEqual(ids(a, b));
  });

  it('soft-deleting an entry advances its tags', async () => {
    const {user1, user1Client, a, b, entry} = await tagged();
    const before = await latest(user1);
    const response = await user1Client.delete(`/api/v1/entries/${entry.id}`);
    expect(response.status).toBe(200);
    expect(await syncFrom(user1Client, before)).toEqual(ids(a, b));
  });

  it('tagging an entry advances the tag, and the tags it was in', async () => {
    const {user1, user1Client, a, b, c, entry} = await tagged();
    const before = await latest(user1);
    const response = await user1Client.post(
      '/api/v1/tags_entries',
      tagging(c.id, entry.id)
    );
    expect(response.status).toBe(201);
    expect(await syncFrom(user1Client, before)).toEqual(ids(a, b, c));
    expect((await refreshTag(c.id))?.entry_count).toBe(1);
  });

  it('tagging an already tagged entry leaves its tags alone', async () => {
    const {user1, user1Client, a, entry} = await tagged();
    const before = await latest(user1);
    const response = await user1Client.post(
      '/api/v1/tags_entries',
      tagging(a.id, entry.id)
    );
    expect(response.status).toBe(200);
    expect(await syncFrom(user1Client, before)).toEqual([]);
  });

  it('untagging advances the tag the entry left, and its other tags', async () => {
    const {user1, user1Client, a, b} = await tagged();
    const [junction] = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.tag_id, a.id));
    const before = await latest(user1);
    const response = await user1Client.delete(
      `/api/v1/tags_entries/${junction?.id}`
    );
    expect(response.status).toBe(200);
    expect(await syncFrom(user1Client, before)).toEqual(ids(a, b));
    const left = await refreshTag(a.id);
    expect(left?.entry_count).toBe(0);
    // The entry is no longer among the tag's entries: the tag's own revision
    // is what tells a client to re-read them.
    const listed = await json(
      await user1Client.get(`/api/v1/entries?filter[tags.id]=${a.id}`)
    );
    expect(listed.data).toEqual([]);
  });

  it('re-ranking entries advances the tag', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const [e1, e2] = [
      await textEntryFactory({user: user1}),
      await textEntryFactory({user: user1}),
    ];
    const j1 = await tagTextEntryFactory({
      tag,
      text_entry: e1,
      user: user1,
      order: 0,
    });
    const j2 = await tagTextEntryFactory({
      tag,
      text_entry: e2,
      user: user1,
      order: 1,
    });
    const before = await latest(user1);
    const response = await user1Client.post('/api/v1/tags_entries/reorder', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {top: j2.id, bottom: j1.id},
        relationships: {},
      },
    });
    expect(response.status).toBe(200);
    expect(await syncFrom(user1Client, before)).toEqual(ids(tag));
  });

  it('recording a reuse leaves the tags alone', async () => {
    const {user1, user1Client, entry} = await tagged();
    const before = await latest(user1);
    const response = await user1Client.post('/api/v1/entry_reuses', {
      data: {
        type: 'TextEntryReused',
        attributes: {},
        relationships: {
          text_entry: {data: {type: 'TextEntry', id: entry.id}},
        },
      },
    });
    expect(response.status).toBe(201);
    expect(await syncFrom(user1Client, before)).toEqual([]);
  });

  it('junction writes outside the API advance the tag too', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const junction = await tagTextEntryFactory({
      tag,
      text_entry: entry,
      user: user1,
    });
    const added = await revisionOf(tag);
    expect(added > tag.date_updated).toBe(true);
    await db().delete(tagsEntries).where(eq(tagsEntries.id, junction.id));
    expect((await revisionOf(tag)) > added).toBe(true);
  });

  it("follow the user's latest tag revision by a millisecond", async () => {
    const {user1, user2, user1Client, a, entry} = await tagged();
    const other = await tagFactory({user: user1});
    const theirs = await tagFactory({user: user2});
    await db()
      .update(tags)
      .set({date_updated: '2999-01-01T00:00:00.000000'})
      .where(eq(tags.id, other.id));
    await db()
      .update(tags)
      .set({date_updated: '3999-01-01T00:00:00.000000'})
      .where(eq(tags.id, theirs.id));
    const response = await user1Client.patch(
      `/api/v1/entries/${entry.id}`,
      edit(entry, 'edited')
    );
    expect(response.status).toBe(200);
    // Another user's rows never push them forward.
    expect(await revisionOf(a)).toBe('2999-01-01T00:00:00.001000');
    expect(user1.id).not.toBe(user2.id);
  });
});
