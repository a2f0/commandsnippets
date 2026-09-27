import {eq} from 'drizzle-orm';
import {describe, expect, it, vi} from 'vitest';
import {tags, textEntries} from '../../src/db/schema';
import {
  db,
  json,
  refreshEntry,
  setUpBase,
  tagFactory,
  textEntryFactory,
} from '../helpers';

const FIXED_WIDTH = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/;

// Sync fetches `date_updated > <latest seen>`, so a user's revisions must be
// strictly increasing in commit order, whatever the Worker's clock says.
describe('database-assigned revisions', () => {
  it('stay strictly increasing even when the Worker clock is far behind', async () => {
    const {user1, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    vi.spyOn(Date, 'now').mockReturnValue(Date.UTC(2001, 0, 1));
    const edit = (body: string) =>
      user1Client.patch(`/api/v1/entries/${entry.id}`, {
        data: {type: 'TextEntry', id: String(entry.id), attributes: {body}},
      });

    let previous = entry.date_updated;
    for (const body of ['one', 'two', 'three']) {
      expect((await edit(body)).status).toBe(200);
      const current = (await refreshEntry(entry.id))?.date_updated ?? '';
      expect(current).toMatch(FIXED_WIDTH);
      expect(current > previous).toBe(true);
      previous = current;
    }
  });

  it('follow a row another isolate stamped in the future, by one microsecond', async () => {
    const {user1, user1Client} = await setUpBase();
    const future = '2999-01-01T00:00:00.000000';
    const stamped = await textEntryFactory({user: user1});
    await db()
      .update(textEntries)
      .set({date_updated: future})
      .where(eq(textEntries.id, stamped.id));

    const created = await json(
      await user1Client.post('/api/v1/entries', {
        data: {type: 'TextEntry', attributes: {subject: 's', body: 'b'}},
      })
    );
    expect(created.data.attributes.date_updated).toBe(
      '2999-01-01T00:00:00.000001'
    );
  });

  it("are per user: another user's rows never push them forward", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const theirs = await textEntryFactory({user: user2});
    await db()
      .update(textEntries)
      .set({date_updated: '2999-01-01T00:00:00.000000'})
      .where(eq(textEntries.id, theirs.id));
    const created = await json(
      await user1Client.post('/api/v1/entries', {
        data: {type: 'TextEntry', attributes: {subject: 's', body: 'b'}},
      })
    );
    expect(created.data.attributes.date_updated < '2999').toBe(true);
    expect(user1.id).not.toBe(user2.id);
  });

  it('stamp every row a reorder touches after the user’s latest revision', async () => {
    const {user1, user1Client} = await setUpBase();
    const a = await tagFactory({user: user1, order: 100});
    const b = await tagFactory({user: user1, order: 101});
    await db()
      .update(tags)
      .set({date_updated: '2999-01-01T00:00:00.000000'})
      .where(eq(tags.id, a.id));
    const response = await user1Client.post('/api/v1/tags/reorder', {
      data: {
        type: 'Tag',
        attributes: {top: b.id, bottom: a.id},
        relationships: {},
      },
    });
    expect(response.status).toBe(200);
    const rows = await db()
      .select()
      .from(tags)
      .where(eq(tags.user_id, user1.id));
    const byId = new Map(rows.map(row => [row.id, row.date_updated]));
    expect(byId.get(a.id)).toBe('2999-01-01T00:00:00.000001');
    expect(byId.get(b.id)).toBe('2999-01-01T00:00:00.000001');
  });

  it('are used by soft deletes too', async () => {
    const {user1, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    await db()
      .update(textEntries)
      .set({date_updated: '2999-01-01T00:00:00.000000'})
      .where(eq(textEntries.id, entry.id));
    const tag = await tagFactory({user: user1});
    await db()
      .update(tags)
      .set({date_updated: '2999-01-01T00:00:00.000000'})
      .where(eq(tags.id, tag.id));
    await user1Client.delete(`/api/v1/entries/${entry.id}`);
    await user1Client.delete(`/api/v1/tags/${tag.id}`);
    expect((await refreshEntry(entry.id))?.date_updated).toBe(
      '2999-01-01T00:00:00.000001'
    );
    const [deletedTag] = await db()
      .select()
      .from(tags)
      .where(eq(tags.id, tag.id));
    expect(deletedTag?.date_updated).toBe('2999-01-01T00:00:00.000001');
  });
});
