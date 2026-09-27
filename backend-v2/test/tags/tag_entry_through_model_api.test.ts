import {describe, expect, it} from 'vitest';
import {
  type Base,
  json,
  refreshEntry,
  refreshJunction,
  refreshTag,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
} from '../helpers';

const reorderPayload = (top: number | string, bottom: number | string) => ({
  data: {
    type: 'TagTextEntryThroughModel',
    attributes: {top, bottom},
    relationships: {},
  },
});

const tagPayload = (tagId: number | string, textEntryId: number | string) => ({
  data: {
    type: 'TagTextEntryThroughModel',
    attributes: {},
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: textEntryId}},
    },
  },
});

// backend/tearleads/tags/tests/test_tag_entry_through_model_api.py
describe('TestTagsEntriesApi', () => {
  let base: Base;

  it('test_retrieve_fails', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const tagTextEntry = await tagTextEntryFactory({
      tag,
      text_entry: textEntry,
      user: base.user1,
    });
    const response = await base.user1Client.get(
      `/api/v1/tags_entries/${tagTextEntry.id}`
    );
    expect(response.status).toBe(405);
  });

  it('test_list_fails', async () => {
    base = await setUpBase();
    const response = await base.user1Client.get('/api/v1/tags_entries');
    expect(response.status).toBe(405);
  });

  it('test_can_tag_self_owned', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const response = await base.user1Client.post(
      '/api/v1/tags_entries',
      tagPayload(tag.id, textEntry.id)
    );
    expect(response.status).toBe(201);
  });

  it('test_create_requires_authentication', async () => {
    base = await setUpBase();
    const response = await base.unauthenticatedClient.post(
      '/api/v1/tags_entries',
      {}
    );
    const body = await json(response);
    expect(response.status).toBe(403);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      'Authentication credentials were not provided.'
    );
  });

  it('test_reorder_requires_authentication', async () => {
    base = await setUpBase();
    const response = await base.unauthenticatedClient.post(
      '/api/v1/tags_entries/reorder',
      {}
    );
    const body = await json(response);
    expect(response.status).toBe(403);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      'Authentication credentials were not provided.'
    );
  });

  it('test_reorder_works', async () => {
    base = await setUpBase();
    const entry1 = await textEntryFactory({user: base.user1});
    const entry2 = await textEntryFactory({user: base.user1});
    const tag1 = await tagFactory({user: base.user1});
    const tagEntry1 = await tagTextEntryFactory({
      text_entry: entry1,
      tag: tag1,
      user: base.user1,
      order: 1,
    });
    const tagEntry1Timestamp = tagEntry1.date_updated;
    const tagEntry2 = await tagTextEntryFactory({
      text_entry: entry2,
      tag: tag1,
      user: base.user1,
      order: 2,
    });
    const tagEntry2Timestamp = tagEntry2.date_updated;

    // Verify initial state
    expect(tagEntry1.order).toBeLessThan(tagEntry2.order);

    // Perform reorder
    const response = await base.user1Client.post(
      '/api/v1/tags_entries/reorder',
      reorderPayload(tagEntry2.id, tagEntry1.id)
    );
    expect(response.status).toBe(200);

    // Verify timestamps were updated
    expect(tagEntry1Timestamp).toBe(tagEntry1.date_updated);
    expect(tagEntry2Timestamp).toBe(tagEntry2.date_updated);
    const after1 = await refreshJunction(tagEntry1.id);
    const after2 = await refreshJunction(tagEntry2.id);
    expect(after1?.date_updated).not.toBe(tagEntry1Timestamp);
    expect(after2?.date_updated).not.toBe(tagEntry2Timestamp);

    // Verify order was changed
    expect(after2?.order).toBeLessThan(after1?.order as number);
  });

  it('test_reorder_fails_if_not_top_owner', async () => {
    base = await setUpBase();
    const entry1 = await textEntryFactory({user: base.user2});
    const entry2 = await textEntryFactory({user: base.user1});
    const tag1 = await tagFactory({user: base.user1});
    const tagEntry1 = await tagTextEntryFactory({
      text_entry: entry1,
      tag: tag1,
      user: base.user2,
      order: 1,
    });
    const tagEntry1Timestamp = tagEntry1.date_updated;
    const tagEntry2 = await tagTextEntryFactory({
      text_entry: entry2,
      tag: tag1,
      user: base.user1,
      order: 2,
    });
    const tagEntry2Timestamp = tagEntry2.date_updated;

    expect(tagEntry1.order).toBeLessThan(tagEntry2.order);

    const response = await base.user1Client.post(
      '/api/v1/tags_entries/reorder',
      reorderPayload(tagEntry2.id, tagEntry1.id)
    );
    expect(response.status).toBe(403);

    // Verify timestamps were NOT updated
    const after1 = await refreshJunction(tagEntry1.id);
    const after2 = await refreshJunction(tagEntry2.id);
    expect(after1?.date_updated).toBe(tagEntry1Timestamp);
    expect(after2?.date_updated).toBe(tagEntry2Timestamp);

    // Verify order was NOT changed
    expect(after1?.order).toBeLessThan(after2?.order as number);
  });

  it('test_reorder_fails_if_not_bottom_owner', async () => {
    base = await setUpBase();
    const entry1 = await textEntryFactory({user: base.user1});
    const entry2 = await textEntryFactory({user: base.user2});
    const tag1 = await tagFactory({user: base.user1});
    const tagEntry1 = await tagTextEntryFactory({
      text_entry: entry1,
      tag: tag1,
      user: base.user1,
      order: 1,
    });
    const tagEntry1Timestamp = tagEntry1.date_updated;
    const tagEntry2 = await tagTextEntryFactory({
      text_entry: entry2,
      tag: tag1,
      user: base.user2,
      order: 2,
    });
    const tagEntry2Timestamp = tagEntry2.date_updated;

    expect(tagEntry1.order).toBeLessThan(tagEntry2.order);

    const response = await base.user1Client.post(
      '/api/v1/tags_entries/reorder',
      reorderPayload(tagEntry2.id, tagEntry1.id)
    );
    expect(response.status).toBe(403);

    const after1 = await refreshJunction(tagEntry1.id);
    const after2 = await refreshJunction(tagEntry2.id);
    expect(after1?.date_updated).toBe(tagEntry1Timestamp);
    expect(after2?.date_updated).toBe(tagEntry2Timestamp);
    expect(after1?.order).toBeLessThan(after2?.order as number);
  });

  it('test_delete_requires_authentication', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const tagTextEntry = await tagTextEntryFactory({
      tag,
      text_entry: textEntry,
      user: base.user1,
    });
    const response = await base.unauthenticatedClient.delete(
      `/api/v1/tags_entries/${tagTextEntry.id}`
    );
    const body = await json(response);
    expect(response.status).toBe(403);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      'Authentication credentials were not provided.'
    );
    expect(await refreshJunction(tagTextEntry.id)).toBeDefined();
  });

  it('test_delete_succeeds_when_user_owns_relationship', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const tagTextEntry = await tagTextEntryFactory({
      tag,
      text_entry: textEntry,
      user: base.user1,
    });

    // Verify the relationship exists
    expect(await refreshJunction(tagTextEntry.id)).toBeDefined();

    const response = await base.user1Client.delete(
      `/api/v1/tags_entries/${tagTextEntry.id}`
    );
    expect(response.status).toBe(204);

    // Verify the relationship was deleted
    expect(await refreshJunction(tagTextEntry.id)).toBeUndefined();
  });

  it('test_delete_fails_when_user_doesnt_own_relationship', async () => {
    base = await setUpBase();
    // Create a relationship owned by user2
    const tag = await tagFactory({user: base.user2});
    const textEntry = await textEntryFactory({user: base.user2});
    const tagTextEntry = await tagTextEntryFactory({
      tag,
      text_entry: textEntry,
      user: base.user2,
    });

    expect(await refreshJunction(tagTextEntry.id)).toBeDefined();

    // Try to delete as user1 (should fail)
    const response = await base.user1Client.delete(
      `/api/v1/tags_entries/${tagTextEntry.id}`
    );
    expect(response.status).toBe(403);

    // Verify the relationship still exists
    expect(await refreshJunction(tagTextEntry.id)).toBeDefined();
  });
});

// v2-specific behavior (no Django equivalent).
describe('TestTagsEntriesApi v2', () => {
  let base: Base;

  it('returns 405 for GET, PATCH and PUT', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const junction = await tagTextEntryFactory({
      tag,
      text_entry: textEntry,
      user: base.user1,
    });
    const path = `/api/v1/tags_entries/${junction.id}`;
    for (const response of [
      await base.user1Client.patch(path, {}),
      await base.user1Client.put(path, {}),
      await base.user1Client.get(path),
    ]) {
      const body = await json(response);
      expect(response.status).toBe(405);
      expect(body.errors[0].code).toBe('method_not_allowed');
    }
  });

  it('returns 404 when deleting a missing junction', async () => {
    base = await setUpBase();
    const response = await base.user1Client.delete(
      '/api/v1/tags_entries/999999'
    );
    const body = await json(response);
    expect(response.status).toBe(404);
    expect(body.errors[0].detail).toBe(
      'No TagTextEntryThroughModel matches the given query.'
    );
  });

  it('renders the created junction with its tag, entry and user', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const response = await base.user1Client.post(
      '/api/v1/tags_entries',
      tagPayload(String(tag.id), String(textEntry.id))
    );
    const body = await json(response);
    expect(response.status).toBe(201);
    expect(body.data.type).toBe('TagTextEntryThroughModel');
    expect(Object.keys(body.data.attributes)).toEqual([
      'order',
      'date_updated',
      'date_created',
    ]);
    expect(body.data.relationships.tag.data).toEqual({
      type: 'Tag',
      id: String(tag.id),
    });
    expect(
      body.included.map((resource: {type: string}) => resource.type)
    ).toEqual(['Tag', 'TextEntry', 'User']);
    const includedTag = body.included[0];
    expect(includedTag.attributes.entry_count).toBe(1);
    const includedEntry = body.included[1];
    expect(includedEntry.attributes.tag_count).toBe(1);
    expect(includedEntry.relationships.text_entry_to_tag).toEqual({
      data: [{type: 'TagTextEntryThroughModel', id: body.data.id}],
      meta: {count: 1},
    });
  });

  it('is idempotent (get_or_create)', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const textEntry = await textEntryFactory({user: base.user1});
    const first = await json(
      await base.user1Client.post(
        '/api/v1/tags_entries',
        tagPayload(tag.id, textEntry.id)
      )
    );
    const response = await base.user1Client.post(
      '/api/v1/tags_entries',
      tagPayload(tag.id, textEntry.id)
    );
    const second = await json(response);
    expect(response.status).toBe(201);
    expect(second.data.id).toBe(first.data.id);
    expect((await refreshEntry(textEntry.id))?.tag_count).toBe(1);
    expect((await refreshTag(tag.id))?.entry_count).toBe(1);
  });

  it('ranks junctions per tag', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const otherTag = await tagFactory({user: base.user1});
    const entries = [
      await textEntryFactory({user: base.user1}),
      await textEntryFactory({user: base.user1}),
    ];
    // A junction in another tag doesn't affect this tag's ranks.
    await tagTextEntryFactory({
      tag: otherTag,
      text_entry: entries[0] as never,
      user: base.user1,
      order: 7,
    });
    const orders: number[] = [];
    for (const entry of entries) {
      const body = await json(
        await base.user1Client.post(
          '/api/v1/tags_entries',
          tagPayload(tag.id, entry.id)
        )
      );
      orders.push(body.data.attributes.order);
    }
    expect(orders).toEqual([0, 1]);
  });

  // v2: the tag and entry must belong to the requester (Django accepted any).
  it("rejects tagging with another user's tag or entry", async () => {
    base = await setUpBase();
    const ownTag = await tagFactory({user: base.user1});
    const ownEntry = await textEntryFactory({user: base.user1});
    const otherTag = await tagFactory({user: base.user2});
    const otherEntry = await textEntryFactory({user: base.user2});

    let response = await base.user1Client.post(
      '/api/v1/tags_entries',
      tagPayload(otherTag.id, ownEntry.id)
    );
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors).toEqual([
      {
        detail: `Invalid pk "${otherTag.id}" - object does not exist.`,
        status: '400',
        source: {pointer: '/data/relationships/tag'},
        code: 'does_not_exist',
      },
    ]);

    response = await base.user1Client.post(
      '/api/v1/tags_entries',
      tagPayload(ownTag.id, otherEntry.id)
    );
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors[0].source.pointer).toBe(
      '/data/relationships/text_entry'
    );
    expect((await refreshEntry(otherEntry.id))?.tag_count).toBe(0);
  });

  it('validates junction relationships', async () => {
    base = await setUpBase();
    let response = await base.user1Client.post('/api/v1/tags_entries', {
      data: {type: 'TagTextEntryThroughModel', attributes: {}},
    });
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(
      body.errors.map((error: {detail: string; source: {pointer: string}}) => [
        error.detail,
        error.source.pointer,
      ])
    ).toEqual([
      ['This field is required.', '/data/relationships/tag'],
      ['This field is required.', '/data/relationships/text_entry'],
    ]);

    response = await base.user1Client.post('/api/v1/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {
          tag: {data: null},
          text_entry: {data: {type: 'TextEntry', id: 'abc'}},
        },
      },
    });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors.map((error: {detail: string}) => error.detail)).toEqual([
      'This field may not be null.',
      'Invalid pk "abc" - object does not exist.',
    ]);

    response = await base.user1Client.post('/api/v1/tags_entries', {
      data: {
        type: 'TagTextEntryThroughModel',
        relationships: {tag: {data: 'nope'}},
      },
    });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors[0].detail).toBe(
      'Received data is not a valid JSONAPI Resource Identifier Object'
    );
  });

  // v2: junction ranks are per tag, so cross-tag reorders are rejected.
  it('rejects reordering junctions from different tags', async () => {
    base = await setUpBase();
    const tag1 = await tagFactory({user: base.user1});
    const tag2 = await tagFactory({user: base.user1});
    const entry = await textEntryFactory({user: base.user1});
    const junction1 = await tagTextEntryFactory({
      tag: tag1,
      text_entry: entry,
      user: base.user1,
      order: 1,
    });
    const junction2 = await tagTextEntryFactory({
      tag: tag2,
      text_entry: entry,
      user: base.user1,
      order: 2,
    });
    const response = await base.user1Client.post(
      '/api/v1/tags_entries/reorder',
      reorderPayload(junction2.id, junction1.id)
    );
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors[0].detail).toBe(
      'top and bottom must share the same ordering scope.'
    );
    expect((await refreshJunction(junction2.id))?.order).toBe(2);
  });

  it('leaves a gap (no compaction) when a junction is deleted', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1});
    const junctions = [];
    for (const order of [0, 1, 2]) {
      junctions.push(
        await tagTextEntryFactory({
          tag,
          text_entry: await textEntryFactory({user: base.user1}),
          user: base.user1,
          order,
        })
      );
    }
    const [first, , last] = junctions;
    const response = await base.user1Client.delete(
      `/api/v1/tags_entries/${first?.id}`
    );
    expect(response.status).toBe(204);
    const lastAfter = await refreshJunction(last?.id as number);
    expect(lastAfter?.order).toBe(2);
    expect(lastAfter?.date_updated).toBe(last?.date_updated);
  });
});
