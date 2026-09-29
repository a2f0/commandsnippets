import {describe, expect, it} from 'vitest';
import {type TextEntry, tagsEntries} from '../../src/db/schema';
import {OrderedModel} from '../../src/lib/ordered';
import {revision} from '../../src/lib/revision';
import {tagEntryOrdering} from '../../src/resources/tagsEntries';
import {
  db,
  json,
  refreshEntry,
  refreshJunction,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
} from '../helpers';

type Resource = {type: string; id: string; attributes: {order?: number}};

// Clients sync junctions through /entries (they are included there), filtered
// on the entry's revision, so re-ranking a junction must advance its entry.
describe('junction reorders and incremental entry sync', () => {
  it('advances the revisions of the entries whose junctions moved', async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entries = [];
    for (let i = 0; i < 4; i++) {
      entries.push(await textEntryFactory({user: user1}));
    }
    const [e1, e2, e3, e4] = entries as [
      (typeof entries)[0],
      (typeof entries)[0],
      (typeof entries)[0],
      (typeof entries)[0],
    ];
    // Legacy data: the requester's junction to another user's entry.
    const foreign = await textEntryFactory({user: user2});
    await tagTextEntryFactory({tag, text_entry: e1, user: user1, order: 0});
    const j2 = await tagTextEntryFactory({
      tag,
      text_entry: e2,
      user: user1,
      order: 1,
    });
    await tagTextEntryFactory({
      tag,
      text_entry: foreign,
      user: user1,
      order: 2,
    });
    const j3 = await tagTextEntryFactory({
      tag,
      text_entry: e3,
      user: user1,
      order: 3,
    });
    await tagTextEntryFactory({tag, text_entry: e4, user: user1, order: 4});

    const synced = entries
      .map(entry => entry.date_updated)
      .sort()
      .at(-1) as string;
    const sync = async () =>
      json(
        await user1Client.get(
          `/api/v1/entries?filter[date_updated.gt]=${encodeURIComponent(synced)}&include=text_entry_to_tag`
        )
      );
    expect((await sync()).data).toEqual([]);

    // j3 moves above j2: j2 and the foreign junction shift down one rank.
    const response = await user1Client.post('/api/v1/tags_entries/reorder', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {top: j3.id, bottom: j2.id},
        relationships: {},
      },
    });
    expect(response.status).toBe(200);

    const body = await sync();
    expect(body.data.map((entry: Resource) => entry.id).sort()).toEqual(
      [String(e2.id), String(e3.id)].sort()
    );
    const orders = Object.fromEntries(
      (body.included as Resource[])
        .filter(resource => resource.type === 'TagTextEntryThroughModel')
        .map(resource => [resource.id, resource.attributes.order])
    );
    expect(orders).toEqual({[j3.id]: 1, [j2.id]: 2});

    // Entries whose junctions kept their ranks, and other users' entries, are
    // untouched.
    for (const entry of [e1, e4, foreign]) {
      expect((await refreshEntry(entry.id))?.date_updated).toBe(
        entry.date_updated
      );
    }
  });

  it('touches no entry when the move does not apply', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const e1 = await textEntryFactory({user: user1});
    const e2 = await textEntryFactory({user: user1});
    const j1 = await tagTextEntryFactory({
      tag,
      text_entry: e1,
      user: user1,
      order: 0,
    });
    // The owner's newest junction, which a move would have stamped.
    await tagTextEntryFactory({tag, text_entry: e2, user: user1, order: 1});

    const ordering = new OrderedModel(db(), tagEntryOrdering);
    const stale = {id: j1.id, order: 5, scope: tag.id, owner: user1.id};
    const moved = await ordering.to(
      stale,
      1,
      revision(
        tagsEntries,
        tagsEntries.date_updated,
        tagsEntries.user_id,
        user1.id
      )
    );
    expect(moved).toBe(false);
    for (const entry of [e1, e2]) {
      expect((await refreshEntry(entry.id))?.date_updated).toBe(
        entry.date_updated
      );
    }
  });
});

describe('tagging and untagging advance the entry revision', () => {
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
  const advanced = async (entry: TextEntry) =>
    ((await refreshEntry(entry.id))?.date_updated ?? '') > entry.date_updated;

  it('tagging an entry advances it', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const response = await user1Client.post(
      '/api/v1/tags_entries',
      tagging(tag.id, entry.id)
    );
    expect(response.status).toBe(201);
    expect(await advanced(entry)).toBe(true);
  });

  it('tagging an already tagged entry leaves it alone', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    await tagTextEntryFactory({tag, text_entry: entry, user: user1});
    const response = await user1Client.post(
      '/api/v1/tags_entries',
      tagging(tag.id, entry.id)
    );
    expect(response.status).toBe(201);
    expect(await advanced(entry)).toBe(false);
  });

  it('taking over a legacy junction advances the entry', async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    await tagTextEntryFactory({tag, text_entry: entry, user: user2});
    const response = await user1Client.post(
      '/api/v1/tags_entries',
      tagging(tag.id, entry.id)
    );
    expect(response.status).toBe(201);
    expect(await advanced(entry)).toBe(true);
  });

  it('untagging an entry advances it', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const junction = await tagTextEntryFactory({
      tag,
      text_entry: entry,
      user: user1,
    });
    const response = await user1Client.delete(
      `/api/v1/tags_entries/${junction.id}`
    );
    expect(response.status).toBe(204);
    expect(await refreshJunction(junction.id)).toMatchObject({
      is_deleted: true,
    });
    expect(await advanced(entry)).toBe(true);
  });

  it("untagging never advances another user's entry", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    // Legacy data: the requester's junction to another user's entry.
    const foreign = await textEntryFactory({user: user2});
    const junction = await tagTextEntryFactory({
      tag,
      text_entry: foreign,
      user: user1,
    });
    const response = await user1Client.delete(
      `/api/v1/tags_entries/${junction.id}`
    );
    expect(response.status).toBe(204);
    expect(await advanced(foreign)).toBe(false);
  });
});
