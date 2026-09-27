import {eq} from 'drizzle-orm';
import {describe, expect, it, vi} from 'vitest';
import {tags, tagsEntries} from '../../src/db/schema';
import {now} from '../../src/lib/clock';
import {OrderedModel} from '../../src/lib/ordered';
import {db, json, setUpBase, tagFactory, textEntryFactory} from '../helpers';

// Races between the existence check and the INSERT, simulated by having
// another writer land while the request computes the new row's rank.
describe('concurrent creates', () => {
  it('tag create returns the tag a concurrent request just created', async () => {
    const {user1, user1Client} = await setUpBase();
    let concurrentId = 0;
    vi.spyOn(OrderedModel.prototype, 'nextOrder').mockImplementationOnce(
      async () => {
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
        return 51;
      }
    );
    const response = await user1Client.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name: 'racy'}},
    });
    expect(response.status).toBe(201);
    expect((await json(response)).data.id).toBe(String(concurrentId));
  });

  it('tag create surfaces database errors that are not races', async () => {
    const {user1Client} = await setUpBase();
    vi.spyOn(OrderedModel.prototype, 'nextOrder').mockResolvedValueOnce(-1);
    const response = await user1Client.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name: 'negative-rank'}},
    });
    expect(response.status).toBe(500);
    expect((await json(response)).errors[0].detail).toBe(
      'A server error occurred.'
    );
  });

  it('tagging returns the junction a concurrent request just created', async () => {
    const {user1, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    vi.spyOn(OrderedModel.prototype, 'nextOrder').mockImplementationOnce(
      async () => {
        const timestamp = now();
        await db().insert(tagsEntries).values({
          tag_id: tag.id,
          text_entry_id: entry.id,
          user_id: user1.id,
          order: 7,
          date_created: timestamp,
          date_updated: timestamp,
        });
        return 8;
      }
    );
    const response = await user1Client.post('/api/v1/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {},
        relationships: {
          tag: {data: {type: 'Tag', id: tag.id}},
          text_entry: {data: {type: 'TextEntry', id: entry.id}},
        },
      },
    });
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
    vi.spyOn(OrderedModel.prototype, 'nextOrder').mockResolvedValueOnce(-1);
    const response = await user1Client.post('/api/v1/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        attributes: {},
        relationships: {
          tag: {data: {type: 'Tag', id: tag.id}},
          text_entry: {data: {type: 'TextEntry', id: entry.id}},
        },
      },
    });
    expect(response.status).toBe(500);
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
