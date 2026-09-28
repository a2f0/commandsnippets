import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {entryReuses} from '../../src/db/schema';
import {
  type Base,
  db,
  type Json,
  json,
  refreshEntry,
  setUpBase,
  textEntryFactory,
  textEntryReusedFactory,
} from '../helpers';

const reusePayload = (textEntryId: number | string) => ({
  data: {
    type: 'TextEntryReused',
    attributes: {},
    relationships: {
      text_entry: {data: {type: 'TextEntry', id: textEntryId}},
    },
  },
});

// Django origin: backend/tearleads/text_entries/tests/test_tag_entries_reused_api.py
// (its class is misnamed TestTagsEntriesApi there)
describe('TestTagEntriesReusedApi', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('test_serialization_format', async () => {
    const {user1, user1Client} = base;
    const textEntry = await textEntryFactory({user: user1});
    const textEntryReused = await textEntryReusedFactory({
      text_entry: textEntry,
      user: user1,
    });
    const response = await user1Client.get(
      `/api/v1/entry_reuses/${textEntryReused.id}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.id).toBe(String(textEntryReused.id));
    expect(jsonResponse.data.type).toBe('TextEntryReused');
    expect(jsonResponse.data.relationships.text_entry.data.id).toBe(
      String(textEntry.id)
    );
    expect(jsonResponse.data.relationships.text_entry.data.type).toBe(
      'TextEntry'
    );
    expect(jsonResponse.data.relationships.user.data.id).toBe(String(user1.id));
    expect(jsonResponse.data.relationships.user.data.type).toBe('User');
  });

  it('test_can_reuse_self_owned', async () => {
    const {user1, user1Client} = base;
    const textEntry = await textEntryFactory({user: user1});
    expect(textEntry.reused_count).toBe(0);
    const response = await user1Client.post(
      '/api/v1/entry_reuses',
      reusePayload(textEntry.id)
    );
    expect(response.status).toBe(201);
    const refreshed = await refreshEntry(textEntry.id);
    expect(refreshed?.reused_count).toBe(1);
  });

  it('test_can_delete_self_owned_reuse', async () => {
    const {user1, user1Client} = base;
    const textEntry = await textEntryFactory({user: user1});
    const textEntryReused = await textEntryReusedFactory({
      text_entry: textEntry,
      user: user1,
    });
    expect((await refreshEntry(textEntry.id))?.reused_count).toBe(1);
    const response = await user1Client.delete(
      `/api/v1/entry_reuses/${textEntryReused.id}`
    );
    expect(response.status).toBe(204);
    expect((await refreshEntry(textEntry.id))?.reused_count).toBe(0);
  });

  it('test_cannot_delete_owned_by_other', async () => {
    const {user2, user1Client} = base;
    const textEntry = await textEntryFactory({user: user2});
    const textEntryReused = await textEntryReusedFactory({
      text_entry: textEntry,
      user: user2,
    });
    expect((await refreshEntry(textEntry.id))?.reused_count).toBe(1);
    const response = await user1Client.delete(
      `/api/v1/entry_reuses/${textEntryReused.id}`
    );
    expect(response.status).toBe(403);
  });

  it('test_reuse_requires_authentication', async () => {
    const textEntry = await textEntryFactory({user: base.user1});
    const response = await base.unauthenticatedClient.post(
      '/api/v1/entry_reuses',
      reusePayload(textEntry.id)
    );
    expect(response.status).toBe(403);
  });

  it('test_bad_filter', async () => {
    const response = await base.user1Client.get(
      '/api/v1/entry_reuses?filter[bad]=1'
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe('invalid filter[bad]');
  });
});

// v2-specific behavior: owner-scoped reads, related-object validation and
// trigger-maintained counters.
describe('EntryReusesApi v2', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('lists only the requesting user’s reuses, oldest first', async () => {
    const {user1, user2, user1Client} = base;
    const mine = await textEntryFactory({user: user1});
    const theirs = await textEntryFactory({user: user2});
    const first = await textEntryReusedFactory({text_entry: mine, user: user1});
    const second = await textEntryReusedFactory({
      text_entry: mine,
      user: user1,
    });
    await textEntryReusedFactory({text_entry: theirs, user: user2});

    const response = await user1Client.get('/api/v1/entry_reuses');
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.map((reuse: Json) => reuse.id)).toEqual([
      String(first.id),
      String(second.id),
    ]);
    expect(jsonResponse.meta.pagination.count).toBe(2);

    const sorted = await json(
      await user1Client.get('/api/v1/entry_reuses?sort=-date_created')
    );
    expect(sorted.data.map((reuse: Json) => reuse.id)).toEqual([
      String(second.id),
      String(first.id),
    ]);

    const badSort = await user1Client.get('/api/v1/entry_reuses?sort=d');
    expect(badSort.status).toBe(400);
    expect((await json(badSort)).errors[0].detail).toBe(
      'invalid sort parameter: d'
    );
  });

  it('rejects anonymous list and retrieve', async () => {
    const entry = await textEntryFactory({user: base.user1});
    const reuse = await textEntryReusedFactory({
      text_entry: entry,
      user: base.user1,
    });
    for (const path of [
      '/api/v1/entry_reuses',
      `/api/v1/entry_reuses/${reuse.id}`,
    ]) {
      const response = await base.unauthenticatedClient.get(path);
      expect(response.status).toBe(403);
      expect((await json(response)).errors[0].detail).toBe(
        'Authentication credentials were not provided.'
      );
    }
  });

  it("forbids retrieving another user's reuse and 404s on missing ids", async () => {
    const entry = await textEntryFactory({user: base.user2});
    const reuse = await textEntryReusedFactory({
      text_entry: entry,
      user: base.user2,
    });
    const forbidden = await base.user1Client.get(
      `/api/v1/entry_reuses/${reuse.id}`
    );
    expect(forbidden.status).toBe(403);
    expect((await json(forbidden)).errors[0].detail).toBe(
      'You do not have permission to perform this action.'
    );

    for (const id of ['999999', 'abc']) {
      const missing = await base.user1Client.get(`/api/v1/entry_reuses/${id}`);
      expect(missing.status).toBe(404);
      expect((await json(missing)).errors[0].detail).toBe(
        'No TextEntryReused matches the given query.'
      );
    }
  });

  it("rejects reusing another user's entry", async () => {
    const theirs = await textEntryFactory({user: base.user2});
    const response = await base.user1Client.post(
      '/api/v1/entry_reuses',
      reusePayload(theirs.id)
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(jsonResponse.errors).toEqual([
      {
        detail: `Invalid pk "${theirs.id}" - object does not exist.`,
        status: '400',
        source: {pointer: '/data/relationships/text_entry'},
        code: 'does_not_exist',
      },
    ]);
    expect((await refreshEntry(theirs.id))?.reused_count).toBe(0);
  });

  it('validates the text_entry relationship', async () => {
    const {user1Client} = base;
    const missing = await user1Client.post('/api/v1/entry_reuses', {
      data: {type: 'TextEntryReused', attributes: {}, relationships: {}},
    });
    expect(missing.status).toBe(400);
    expect((await json(missing)).errors[0].detail).toBe(
      'This field is required.'
    );

    const nulled = await user1Client.post('/api/v1/entry_reuses', {
      data: {
        type: 'TextEntryReused',
        relationships: {text_entry: {data: null}},
      },
    });
    expect(nulled.status).toBe(400);
    expect((await json(nulled)).errors[0].detail).toBe(
      'This field may not be null.'
    );

    const nonNumeric = await user1Client.post(
      '/api/v1/entry_reuses',
      reusePayload('abc')
    );
    expect(nonNumeric.status).toBe(400);
    expect((await json(nonNumeric)).errors[0].detail).toBe(
      'Invalid pk "abc" - object does not exist.'
    );

    const malformed = await user1Client.post('/api/v1/entry_reuses', {
      data: {
        type: 'TextEntryReused',
        relationships: {text_entry: {data: {type: 'TextEntry'}}},
      },
    });
    expect(malformed.status).toBe(400);
  });

  it('responds 405 to PATCH and PUT', async () => {
    const entry = await textEntryFactory({user: base.user1});
    const reuse = await textEntryReusedFactory({
      text_entry: entry,
      user: base.user1,
    });
    for (const method of ['PATCH', 'PUT']) {
      const response = await base.user1Client.request(
        method,
        `/api/v1/entry_reuses/${reuse.id}`,
        {data: {type: 'TextEntryReused', id: String(reuse.id)}}
      );
      expect(response.status).toBe(405);
      expect((await json(response)).errors[0].detail).toBe(
        `Method "${method}" not allowed.`
      );
    }
  });

  it('maintains reused_count and reused_date through the triggers', async () => {
    const {user1, user1Client} = base;
    const entry = await textEntryFactory({user: user1});
    expect(entry.reused_count).toBe(0);
    expect(entry.reused_date).toBeNull();

    const created = await json(
      await user1Client.post('/api/v1/entry_reuses', reusePayload(entry.id))
    );
    const [reuse] = await db()
      .select()
      .from(entryReuses)
      .where(eq(entryReuses.id, Number(created.data.id)));
    let refreshed = await refreshEntry(entry.id);
    expect(refreshed?.reused_count).toBe(1);
    expect(refreshed?.reused_date).toBe(reuse?.date_created);

    await textEntryReusedFactory({text_entry: entry, user: user1});
    expect((await refreshEntry(entry.id))?.reused_count).toBe(2);

    const deleted = await user1Client.delete(
      `/api/v1/entry_reuses/${created.data.id}`
    );
    expect(deleted.status).toBe(204);
    expect(await deleted.text()).toBe('');
    refreshed = await refreshEntry(entry.id);
    expect(refreshed?.reused_count).toBe(1);
    // The delete trigger stamps reused_date with the current time in the
    // same fixed-width format.
    expect(refreshed?.reused_date).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}$/
    );
  });

  it('includes the reused entry’s linkage but no included resources by default', async () => {
    const entry = await textEntryFactory({user: base.user1});
    const response = await base.user1Client.post(
      '/api/v1/entry_reuses',
      reusePayload(String(entry.id))
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(201);
    expect(jsonResponse.data.attributes).toEqual({});
    expect(jsonResponse.included).toBeUndefined();

    const withInclude = await json(
      await base.user1Client.get(
        `/api/v1/entry_reuses/${jsonResponse.data.id}?include=text_entry,user`
      )
    );
    expect(withInclude.included.map((item: Json) => item.type)).toEqual([
      'TextEntry',
      'User',
    ]);
  });
});
