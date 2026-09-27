import {eq, sql} from 'drizzle-orm';
import {describe, expect, it, vi} from 'vitest';
import {tags, tagsEntries} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {OrderedModel} from '../../src/lib/ordered';
import {
  ApiClient,
  db,
  json,
  raceBeforeInsert,
  raceBeforeStatement,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  tokenFor,
} from '../helpers';

const tagEntryPayload = (tagId: number, entryId: number) => ({
  data: {
    type: 'TagTextEntryThroughModel',
    attributes: {},
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
    },
  },
});

// Races between the existence check and the INSERT, simulated by having
// another writer land immediately before the request's INSERT executes.
describe('concurrent creates', () => {
  it('tag create returns the tag a concurrent request just created', async () => {
    const {user1} = await setUpBase();
    let concurrentId = 0;
    const client = new ApiClient(
      await tokenFor(user1.id),
      raceBeforeInsert('tags_tag', async () => {
        const timestamp = now();
        const [row] = await db()
          .insert(tags)
          .values({
            name: 'racy',
            user_id: user1.id,
            order: 50,
            date_created: timestamp,
            date_updated: timestamp,
          })
          .returning();
        concurrentId = row?.id ?? 0;
      })
    );
    const response = await client.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name: 'racy'}},
    });
    expect(response.status).toBe(201);
    expect((await json(response)).data.id).toBe(String(concurrentId));
  });

  it('tag create surfaces database errors that are not races', async () => {
    const {user1Client} = await setUpBase();
    vi.spyOn(OrderedModel.prototype, 'nextOrderSql').mockReturnValueOnce(
      sql`-1`
    );
    const response = await user1Client.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name: 'negative-rank'}},
    });
    expect(response.status).toBe(500);
    expect((await json(response)).errors[0].detail).toBe(
      'A server error occurred.'
    );
  });

  it('tagging returns the junction a concurrent request just created', async () => {
    const {user1} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const client = new ApiClient(
      await tokenFor(user1.id),
      raceBeforeInsert('tags_tagtextentrythroughmodel', async () => {
        const timestamp = now();
        await db().insert(tagsEntries).values({
          tag_id: tag.id,
          text_entry_id: entry.id,
          user_id: user1.id,
          order: 7,
          date_created: timestamp,
          date_updated: timestamp,
        });
      })
    );
    const response = await client.post(
      '/api/v1/tags_entries',
      tagEntryPayload(tag.id, entry.id)
    );
    expect(response.status).toBe(201);
    expect((await json(response)).data.attributes.order).toBe(7);
    const rows = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.tag_id, tag.id));
    expect(rows).toHaveLength(1);
  });

  it('tagging surfaces database errors that are not races', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    vi.spyOn(OrderedModel.prototype, 'nextOrderSql').mockReturnValueOnce(
      sql`-1`
    );
    const response = await user1Client.post(
      '/api/v1/tags_entries',
      tagEntryPayload(tag.id, entry.id)
    );
    expect(response.status).toBe(500);
  });

  it('parallel tag creates get distinct ranks', async () => {
    const {user1, user1Client} = await setUpBase();
    const responses = await Promise.all(
      Array.from({length: 6}, (_, i) =>
        user1Client.post('/api/v1/tags', {
          data: {type: 'Tag', attributes: {name: `parallel-${i}`}},
        })
      )
    );
    expect(responses.map(r => r.status)).toEqual(Array(6).fill(201));
    const ranks = (
      await db().select().from(tags).where(eq(tags.user_id, user1.id))
    ).map(tag => tag.order);
    expect(new Set(ranks).size).toBe(ranks.length);
  });

  it('parallel tagging within one tag gets distinct ranks', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entries = await Promise.all(
      Array.from({length: 6}, () => textEntryFactory({user: user1}))
    );
    const responses = await Promise.all(
      entries.map(entry =>
        user1Client.post(
          '/api/v1/tags_entries',
          tagEntryPayload(tag.id, entry.id)
        )
      )
    );
    expect(responses.map(r => r.status)).toEqual(Array(6).fill(201));
    const ranks = (
      await db()
        .select()
        .from(tagsEntries)
        .where(eq(tagsEntries.tag_id, tag.id))
    ).map(row => row.order);
    expect(ranks).toHaveLength(6);
    expect(new Set(ranks).size).toBe(6);
  });
});

describe('tag filters', () => {
  it('filters by exact name', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1, name: 'needle'});
    const response = await user1Client.get('/api/v1/tags?filter[name]=needle');
    const body = await json(response);
    expect(body.data.map((row: {id: string}) => row.id)).toEqual([
      String(tag.id),
    ]);
  });

  it('rejects an invalid date_updated.gt', async () => {
    const {user1Client} = await setUpBase();
    const response = await user1Client.get(
      '/api/v1/tags?filter[date_updated.gt]=yesterday'
    );
    expect(response.status).toBe(400);
    expect((await json(response)).errors[0].detail).toBe(
      'Enter a valid date/time.'
    );
  });
});

describe('concurrent reorders', () => {
  it('re-reads and still lands directly above a reference row that moved mid-reorder', async () => {
    const {user1} = await setUpBase();
    // A clean scope: A(0) B(1) C(2) D(3), owned by a fresh user.
    const owner = user1;
    await db().delete(tags).where(eq(tags.user_id, owner.id));
    const [a, , c] = [
      await tagFactory({user: owner, name: 'a', order: 0}),
      await tagFactory({user: owner, name: 'b', order: 1}),
      await tagFactory({user: owner, name: 'c', order: 2}),
      await tagFactory({user: owner, name: 'd', order: 3}),
    ];
    // Just before the reorder's UPDATE runs, another request moves C (the
    // reference) to the bottom.
    const client = new ApiClient(
      await tokenFor(owner.id),
      raceBeforeStatement(/^\s*update "tags_tag"/i, async () => {
        await db().update(tags).set({order: 10}).where(eq(tags.id, c.id));
      })
    );
    const response = await client.post('/api/v1/tags/reorder', {
      data: {
        type: 'Tag',
        attributes: {top: a.id, bottom: c.id},
        relationships: {},
      },
    });
    expect(response.status).toBe(200);

    const ranked = (
      await db().select().from(tags).where(eq(tags.user_id, owner.id))
    )
      .sort((x, y) => x.order - y.order)
      .map(tag => tag.name);
    expect(ranked).toEqual(['b', 'd', 'a', 'c']);
  });
});

describe('reordering around other users’ legacy junctions', () => {
  it("never shifts or touches another user's junction in the same tag", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const junction = async (user: typeof user1, order: number) =>
      tagTextEntryFactory({
        tag,
        text_entry: await textEntryFactory({user}),
        user,
        order,
      });
    const j1 = await junction(user1, 0);
    const j2 = await junction(user1, 1);
    const foreign = await junction(user2, 2);
    const j3 = await junction(user1, 3);

    const response = await user1Client.post('/api/v1/tags_entries/reorder', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {top: j3.id, bottom: j1.id},
        relationships: {},
      },
    });
    expect(response.status).toBe(200);

    const rows = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.tag_id, tag.id));
    const byId = new Map(rows.map(row => [row.id, row]));
    // The foreign row is exactly as it was.
    expect(byId.get(foreign.id)).toEqual(foreign);
    // The requester's own rows are reordered: j3 now directly above j1.
    const own = rows
      .filter(row => row.user_id === user1.id)
      .sort((a, b) => a.order - b.order)
      .map(row => row.id);
    expect(own).toEqual([j3.id, j1.id, j2.id]);
  });
});

describe('reorders across rank gaps', () => {
  it("re-reads when a concurrent move changes the reference's neighbor", async () => {
    const {user1} = await setUpBase();
    await db().delete(tags).where(eq(tags.user_id, user1.id));
    const s = await tagFactory({user: user1, name: 's', order: 0});
    await tagFactory({user: user1, name: 'p', order: 1});
    const r = await tagFactory({user: user1, name: 'r', order: 5});
    const q = await tagFactory({user: user1, name: 'q', order: 9});
    // Moving s above r targets r's neighbor (p, rank 1). Just before the
    // UPDATE, another request moves q into the gap at rank 3.
    const client = new ApiClient(
      await tokenFor(user1.id),
      raceBeforeStatement(/^\s*update "tags_tag"/i, async () => {
        await db().update(tags).set({order: 3}).where(eq(tags.id, q.id));
      })
    );
    const response = await client.post('/api/v1/tags/reorder', {
      data: {
        type: 'Tag',
        attributes: {top: s.id, bottom: r.id},
        relationships: {},
      },
    });
    expect(response.status).toBe(200);
    const ranked = (
      await db().select().from(tags).where(eq(tags.user_id, user1.id))
    )
      .sort((x, y) => x.order - y.order)
      .map(tag => tag.name);
    // s is still directly above r, with q (moved into the gap) before it.
    expect(ranked).toEqual(['p', 'q', 's', 'r']);
  });
});
