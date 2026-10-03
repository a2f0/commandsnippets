import {describe, expect, it} from 'vitest';
import {
  type Base,
  isoformat,
  json,
  refreshTag,
  setUpBase,
  tagFactory,
  tagsOf,
} from '../helpers';

const TAG_NAME_MAX_LENGTH = 24;

/** Python's `str(datetime)`: isoformat with a space separator. */
const pyStr = (timestamp: string) =>
  encodeURIComponent(isoformat(timestamp).replace('T', ' '));

const reorderPayload = (top: number | string, bottom: number | string) => ({
  data: {type: 'Tag', attributes: {top, bottom}, relationships: {}},
});

// Django origin: backend/tearleads/tags/tests/test_tags_api.py
describe('TestTagsApi', () => {
  let base: Base;

  const expectIncludedUser1 = (response: {included: unknown[]}) => {
    const included = response.included as Array<{
      type: string;
      attributes: Record<string, unknown>;
    }>;
    expect(included).toHaveLength(1);
    const userData = included[0];
    expect(userData?.type).toBe('User');
    expect(Object.keys(userData?.attributes ?? {})).toHaveLength(3);
    expect(userData?.attributes['username']).toBe(base.user1.username);
    expect(userData?.attributes['is_staff']).toBe(false);
    expect(userData?.attributes['date_updated']).toBe(
      isoformat(base.user1.date_updated)
    );
  };

  it('test_serialization_format', async () => {
    base = await setUpBase();
    const [tag] = await tagsOf(base.user1);
    if (tag === undefined) throw new Error('missing tag');

    const response = await base.user1Client.get(
      `/api/v1/tags?&filter[user.username]=${base.user1.username}`
    );
    const body = await json(response);

    expect(response.status).toBe(200);
    const data = body.data;
    expect(data).toHaveLength(2);
    expect(data[0].id).toBe(String(tag.id));

    const attributes = data[0].attributes;
    expect(Object.keys(attributes)).toHaveLength(9);
    expect(attributes.name).toBe(tag.name);
    expect(attributes.date_created).toBe(isoformat(tag.date_created));
    expect(attributes.date_updated).toBe(isoformat(tag.date_updated));
    expect(attributes.date_last_used).toBe(isoformat(tag.date_last_used));
    expect(attributes.is_deleted).toBe(false);
    expect(attributes.entry_count).toBe(tag.entry_count);
    expect(attributes.order).toBe(tag.order);
    expect(attributes.client_id).toBeNull();

    expectIncludedUser1(body);
  });

  it('test_pagination', async () => {
    base = await setUpBase();
    const tags = await tagsOf(base.user1);
    const [tag1, tag2] = tags;
    expect(tags).toHaveLength(2);

    let response = await base.user1Client.get(
      `/api/v1/tags?page[number]=1&page[size]=1&filter[user.username]=${base.user1.username}`
    );
    let body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(String(tag1?.id));
    expect(body.meta.pagination.count).toBe(2);

    response = await base.user1Client.get(
      `/api/v1/tags?page[number]=2&page[size]=1&filter[user.username]=${base.user1.username}`
    );
    body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(String(tag2?.id));
    expect(body.meta.pagination.count).toBe(2);
  });

  it('test_create_requires_authentication', async () => {
    base = await setUpBase();
    const response = await base.unauthenticatedClient.post('/api/v1/tags', {});
    const body = await json(response);
    expect(response.status).toBe(403);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      'Authentication credentials were not provided.'
    );
  });

  it('test_name_too_large', async () => {
    base = await setUpBase();
    const payload = {
      data: {
        type: 'Tag',
        attributes: {name: 'x'.repeat(TAG_NAME_MAX_LENGTH + 1)},
      },
    };
    const response = await base.user1Client.post('/api/v1/tags', payload);
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      `Ensure this field has no more than ${24} characters.`
    );
  });

  it('test_can_create_self_owned', async () => {
    base = await setUpBase();
    const payload = {data: {type: 'Tag', attributes: {name: 'new tag'}}};
    const response = await base.user1Client.post('/api/v1/tags', payload);
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(body.data.attributes.name).toBe(payload.data.attributes.name);
    expectIncludedUser1(body);
  });

  it('test_can_resurrect_self_owned', async () => {
    base = await setUpBase();
    const deletedTag = await tagFactory({
      user: base.user1,
      name: 'deleted tag',
      is_deleted: true,
    });
    const payload = {data: {type: 'Tag', attributes: {name: 'deleted tag'}}};
    const response = await base.user1Client.post('/api/v1/tags', payload);
    const body = await json(response);

    expect(response.status).toBe(201);
    expect(body.data.attributes.name).toBe(payload.data.attributes.name);
    expect(body.data.id).toBe(String(deletedTag.id));
    expectIncludedUser1(body);
  });

  it('test_delete_works_when_self_owns_object', async () => {
    base = await setUpBase();
    const tag = await tagFactory({
      user: base.user1,
      name: 'deleted tag',
      is_deleted: false,
    });
    const response = await base.user1Client.delete(`/api/v1/tags/${tag.id}`);
    const body = await json(response);

    expect(response.status).toBe(200);
    expect(body.data.attributes.is_deleted).toBe(true);
    expectIncludedUser1(body);
  });

  it('test_delete_fails_when_object_owned_by_other', async () => {
    base = await setUpBase();
    const tag = await tagFactory({
      user: base.user2,
      name: 'deleted tag',
      is_deleted: false,
    });
    const response = await base.user1Client.delete(`/api/v1/tags/${tag.id}`);
    const body = await json(response);
    expect(response.status).toBe(403);
    expect(body.errors[0].detail).toBe(
      'You do not have permission to perform this action.'
    );
  });

  it('test_reorder_works', async () => {
    base = await setUpBase();
    const tag1 = await tagFactory({user: base.user1, order: 1});
    const tag1Timestamp = tag1.date_updated;
    const tag2 = await tagFactory({user: base.user1, order: 2});
    const tag2Timestamp = tag2.date_updated;

    expect(tag1.order).toBeLessThan(tag2.order);
    const response = await base.user1Client.post(
      '/api/v1/tags/reorder',
      reorderPayload(tag2.id, tag1.id)
    );
    expect(response.status).toBe(200);
    expect(tag1Timestamp).toBe(tag1.date_updated);
    expect(tag2Timestamp).toBe(tag2.date_updated);
    const tag1After = await refreshTag(tag1.id);
    const tag2After = await refreshTag(tag2.id);
    expect(tag1After?.date_updated).not.toBe(tag1Timestamp);
    expect(tag2After?.date_updated).not.toBe(tag2Timestamp);
    expect(tag2After?.order).toBeLessThan(tag1After?.order as number);
  });

  it('test_reorder_fails_if_not_bottom_owner', async () => {
    base = await setUpBase();
    const tag1 = await tagFactory({user: base.user2, order: 1});
    const tag1Timestamp = tag1.date_updated;
    const tag2 = await tagFactory({user: base.user1, order: 2});
    const tag2Timestamp = tag2.date_updated;

    expect(tag1.order).toBeLessThan(tag2.order);
    const response = await base.user1Client.post(
      '/api/v1/tags/reorder',
      reorderPayload(tag2.id, tag1.id)
    );
    expect(response.status).toBe(403);
    const tag1After = await refreshTag(tag1.id);
    const tag2After = await refreshTag(tag2.id);
    expect(tag1After?.date_updated).toBe(tag1Timestamp);
    expect(tag2After?.date_updated).toBe(tag2Timestamp);
    expect(tag1After?.order).toBeLessThan(tag2After?.order as number);
  });

  it('test_reorder_fails_if_not_tio_owner', async () => {
    base = await setUpBase();
    const tag1 = await tagFactory({user: base.user1, order: 1});
    const tag1Timestamp = tag1.date_updated;
    const tag2 = await tagFactory({user: base.user2, order: 2});
    const tag2Timestamp = tag2.date_updated;

    expect(tag1.order).toBeLessThan(tag2.order);
    const response = await base.user1Client.post(
      '/api/v1/tags/reorder',
      reorderPayload(tag2.id, tag1.id)
    );
    expect(response.status).toBe(403);
    const tag1After = await refreshTag(tag1.id);
    const tag2After = await refreshTag(tag2.id);
    expect(tag1After?.date_updated).toBe(tag1Timestamp);
    expect(tag2After?.date_updated).toBe(tag2Timestamp);
    expect(tag1After?.order).toBeLessThan(tag2After?.order as number);
  });

  it('test_bad_filter', async () => {
    base = await setUpBase();
    const response = await base.user1Client.get('/api/v1/tags?filter[bad]=1');
    const body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe('invalid filter[bad]');
  });

  it('test_filter_by_user_name', async () => {
    base = await setUpBase();
    const [tag1, tag2] = await tagsOf(base.user1);

    let response = await base.user1Client.get(
      `/api/v1/tags?filter[user.username]=${base.user1.username}`
    );
    let body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(2);
    expect(body.data[0].id).toBe(String(tag1?.id));
    expect(body.data[1].id).toBe(String(tag2?.id));

    response = await base.user1Client.get(
      '/api/v1/tags?filter[user.username]=random'
    );
    body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
  });

  it('test_filter_by_date_updated_gt', async () => {
    base = await setUpBase();
    const [tag1, tag2] = await tagsOf(base.user1);
    const response = await base.user1Client.get(
      `/api/v1/tags?filter[date_updated.gt]=${pyStr(tag1?.date_updated as string)}&filter[user.username]=${base.user1.username}`
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(String(tag2?.id));
  });

  it('test_order_filter', async () => {
    base = await setUpBase();
    const [tag1, tag2] = await tagsOf(base.user1);

    let response = await base.user1Client.get(
      `/api/v1/tags?sort=invalid_sort_key&filter[user.username]=${base.user1.username}`
    );
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      'invalid sort parameter: invalid_sort_key'
    );

    const sortTests: Array<[string, number, number]> = [
      ['date_created', tag1?.id as number, tag2?.id as number],
      ['-date_created', tag2?.id as number, tag1?.id as number],
      ['date_updated', tag1?.id as number, tag2?.id as number],
      ['-date_updated', tag2?.id as number, tag1?.id as number],
      ['order', tag1?.id as number, tag2?.id as number],
      ['-order', tag2?.id as number, tag1?.id as number],
      ['name', tag1?.id as number, tag2?.id as number],
      ['-name', tag2?.id as number, tag1?.id as number],
    ];
    for (const [sortParam, expectedFirstId, expectedSecondId] of sortTests) {
      response = await base.user1Client.get(
        `/api/v1/tags?sort=${sortParam}&filter[user.username]=${base.user1.username}`
      );
      body = await json(response);
      expect(response.status).toBe(200);
      expect(body.data).toHaveLength(2);
      expect(body.data[0].id).toBe(String(expectedFirstId));
      expect(body.data[1].id).toBe(String(expectedSecondId));
    }
  });

  it('test_inequality_operator', async () => {
    base = await setUpBase();
    const [tag1, tag2] = await tagsOf(base.user1);
    const response = await base.user1Client.get(
      `/api/v1/tags?sort=-date_updated&filter[user.username]=${base.user1.username}&filter[date_updated.gt]=${pyStr(tag1?.date_updated as string)}`
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe(String(tag2?.id));
  });
});

// v2-specific behavior (no Django equivalent).
describe('TestTagsApi v2', () => {
  let base: Base;

  // v2: reads are owner-only (Django allowed anonymous reads).
  it('rejects anonymous list and retrieve', async () => {
    base = await setUpBase();
    const [tag] = await tagsOf(base.user1);
    for (const path of ['/api/v1/tags', `/api/v1/tags/${tag?.id}`]) {
      const response = await base.unauthenticatedClient.get(path);
      const body = await json(response);
      expect(response.status).toBe(403);
      expect(body.errors[0].detail).toBe(
        'Authentication credentials were not provided.'
      );
    }
  });

  // v2: filtering by another user's username returns nothing.
  it("does not list other users' tags", async () => {
    base = await setUpBase();
    const response = await base.user1Client.get(
      `/api/v1/tags?filter[user.username]=${base.user2.username}`
    );
    const body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data).toHaveLength(0);
    expect(body.meta.pagination.count).toBe(0);
    expect(body.links.next).toBeNull();
  });

  it('retrieves own tags, 403s for others, 404s for missing', async () => {
    base = await setUpBase();
    const [own] = await tagsOf(base.user1);
    const [other] = await tagsOf(base.user2);

    let response = await base.user1Client.get(`/api/v1/tags/${own?.id}`);
    let body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.id).toBe(String(own?.id));
    expect(body.data.relationships.user.data).toEqual({
      type: 'User',
      id: String(base.user1.id),
    });

    response = await base.user1Client.get(`/api/v1/tags/${other?.id}`);
    body = await json(response);
    expect(response.status).toBe(403);
    expect(body.errors[0].detail).toBe(
      'You do not have permission to perform this action.'
    );

    for (const id of ['999999', 'abc']) {
      response = await base.user1Client.get(`/api/v1/tags/${id}`);
      body = await json(response);
      expect(response.status).toBe(404);
      expect(body.errors[0].detail).toBe('No Tag matches the given query.');
    }
  });

  it('returns the existing tag when creating a duplicate name', async () => {
    base = await setUpBase();
    const [existing] = await tagsOf(base.user1);
    const response = await base.user1Client.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name: existing?.name}},
    });
    const body = await json(response);
    expect(response.status).toBe(201);
    expect(body.data.id).toBe(String(existing?.id));
    expect(body.data.attributes.is_deleted).toBe(false);
    expect(await tagsOf(base.user1)).toHaveLength(2);
  });

  it('assigns new tags the next rank for the user', async () => {
    base = await setUpBase();
    const response = await base.user1Client.post('/api/v1/tags', {
      data: {type: 'Tag', attributes: {name: 'ranked'}},
    });
    const body = await json(response);
    expect(response.status).toBe(201);
    // Example tags are ranked 1 and 2.
    expect(body.data.attributes.order).toBe(3);
    expect(body.data.attributes.entry_count).toBe(0);
    expect(body.data.attributes.date_last_used).toBe(
      body.data.attributes.date_created
    );
  });

  it('validates tag create payloads', async () => {
    base = await setUpBase();
    const cases: Array<[unknown, number, string]> = [
      [{data: {type: 'Tag', attributes: {}}}, 400, 'This field is required.'],
      [
        {data: {type: 'Tag', attributes: {name: '   '}}},
        400,
        'This field may not be blank.',
      ],
      [{}, 400, 'Received document does not contain primary data'],
      [
        {data: {type: 'TextEntry', attributes: {name: 'x'}}},
        409,
        "The resource object's type (TextEntry) is not the type that constitute the collection represented by the endpoint (Tag).",
      ],
    ];
    for (const [payload, status, detail] of cases) {
      const response = await base.user1Client.post('/api/v1/tags', payload);
      const body = await json(response);
      expect(response.status).toBe(status);
      expect(body.errors[0].detail).toBe(detail);
    }
  });

  it('renames a tag with PATCH and PUT', async () => {
    base = await setUpBase();
    const tag = await tagFactory({user: base.user1, name: 'before'});

    let response = await base.user1Client.patch(`/api/v1/tags/${tag.id}`, {
      data: {id: String(tag.id), type: 'Tag', attributes: {name: 'after'}},
    });
    let body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.attributes.name).toBe('after');
    const renamed = await refreshTag(tag.id);
    expect(renamed?.name).toBe('after');
    expect(renamed?.date_updated).not.toBe(tag.date_updated);

    response = await base.user1Client.put(`/api/v1/tags/${tag.id}`, {
      data: {id: tag.id, type: 'Tag', attributes: {name: 'again'}},
    });
    body = await json(response);
    expect(response.status).toBe(200);
    expect(body.data.attributes.name).toBe('again');
  });

  it('rejects invalid tag renames', async () => {
    base = await setUpBase();
    const [existing] = await tagsOf(base.user1);
    const tag = await tagFactory({user: base.user1, name: 'mine'});
    const patch = (attributes: Record<string, unknown>, id = String(tag.id)) =>
      base.user1Client.patch(`/api/v1/tags/${tag.id}`, {
        data: {id, type: 'Tag', attributes},
      });

    let response = await patch({name: existing?.name});
    let body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors[0].detail).toBe(
      'The fields name, user must make a unique set.'
    );

    response = await patch({name: 'x'.repeat(TAG_NAME_MAX_LENGTH + 1)});
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors).toHaveLength(1);
    expect(body.errors[0].detail).toBe(
      'Ensure this field has no more than 24 characters.'
    );
    expect(body.errors[0].source.pointer).toBe('/data/attributes/name');

    response = await patch({name: 'mismatch'}, '999999');
    expect(response.status).toBe(409);

    response = await base.user1Client.patch(`/api/v1/tags/${tag.id}`, {
      data: {type: 'Tag', attributes: {name: 'no id'}},
    });
    body = await json(response);
    expect(response.status).toBe(400);
    expect(body.errors[0].detail).toBe(
      "The resource identifier object must contain an 'id' member"
    );

    expect((await refreshTag(tag.id))?.name).toBe('mine');
  });

  it("cannot rename another user's tag", async () => {
    base = await setUpBase();
    const [other] = await tagsOf(base.user2);
    const response = await base.user1Client.patch(`/api/v1/tags/${other?.id}`, {
      data: {id: String(other?.id), type: 'Tag', attributes: {name: 'stolen'}},
    });
    expect(response.status).toBe(403);
    expect((await refreshTag(other?.id as number))?.name).toBe(other?.name);
  });

  it('validates reorder payloads', async () => {
    base = await setUpBase();
    const [tag] = await tagsOf(base.user1);
    const cases: Array<[unknown, string, string]> = [
      [
        {data: {type: 'Tag', attributes: {bottom: tag?.id}}},
        'This field is required.',
        '/data/attributes/top',
      ],
      [
        reorderPayload('abc', tag?.id as number),
        'Incorrect type. Expected pk value, received str.',
        '/data/attributes/top',
      ],
      [
        reorderPayload(tag?.id as number, 999999),
        'Invalid pk "999999" - object does not exist.',
        '/data/attributes/bottom',
      ],
      [
        {data: {type: 'Tag', attributes: {top: null, bottom: tag?.id}}},
        'This field may not be null.',
        '/data/attributes/top',
      ],
    ];
    for (const [payload, detail, pointer] of cases) {
      const response = await base.user1Client.post(
        '/api/v1/tags/reorder',
        payload
      );
      const body = await json(response);
      expect(response.status).toBe(400);
      expect(body.errors[0].detail).toBe(detail);
      expect(body.errors[0].source.pointer).toBe(pointer);
    }
  });

  it('moves a tag down (above a lower tag) and up (above a higher tag)', async () => {
    base = await setUpBase();
    const a = await tagFactory({user: base.user1, name: 'a', order: 10});
    const b = await tagFactory({user: base.user1, name: 'b', order: 11});
    const c = await tagFactory({user: base.user1, name: 'c', order: 12});
    const [example1, example2] = await tagsOf(base.user1);
    const ranks = async () =>
      (await tagsOf(base.user1))
        .filter(tag => ['a', 'b', 'c'].includes(tag.name))
        .sort((x, y) => x.order - y.order)
        .map(tag => [tag.name, tag.order]);

    // Down: a above c lands between b and c.
    let response = await base.user1Client.post(
      '/api/v1/tags/reorder',
      reorderPayload(a.id, c.id)
    );
    expect(response.status).toBe(200);
    expect(await ranks()).toEqual([
      ['b', 10],
      ['a', 11],
      ['c', 12],
    ]);
    // c was not in the shifted range, so its timestamp is untouched.
    expect((await refreshTag(c.id))?.date_updated).toBe(c.date_updated);

    // Up: c above b goes to b's rank and pushes b and a down.
    response = await base.user1Client.post(
      '/api/v1/tags/reorder',
      reorderPayload(c.id, b.id)
    );
    expect(response.status).toBe(200);
    expect(await ranks()).toEqual([
      ['c', 10],
      ['b', 11],
      ['a', 12],
    ]);

    // Rows outside the moved range (the example tags) are untouched.
    expect((await refreshTag(example1?.id as number))?.date_updated).toBe(
      example1?.date_updated
    );
    expect((await refreshTag(example2?.id as number))?.date_updated).toBe(
      example2?.date_updated
    );
  });

  // v2: ranks are per user, so reordering never touches another user's tags.
  it("does not touch other users' tags when reordering", async () => {
    base = await setUpBase();
    const [tag1, tag2] = await tagsOf(base.user1);
    const before = await tagsOf(base.user2);
    const response = await base.user1Client.post(
      '/api/v1/tags/reorder',
      reorderPayload(tag2?.id as number, tag1?.id as number)
    );
    expect(response.status).toBe(200);
    expect(await tagsOf(base.user2)).toEqual(before);
  });
});

// Django (and SQLite's length()) count characters; UTF-16 would count each
// emoji twice and reject valid names.
describe('TestTagsApi unicode lengths', () => {
  it('accepts a 24-character name of astral characters and rejects 25', async () => {
    const {user1Client} = await setUpBase();
    const create = (name: string) =>
      user1Client.post('/api/v1/tags', {
        data: {type: 'Tag', attributes: {name}},
      });
    const ok = await create('😀'.repeat(24));
    expect(ok.status).toBe(201);
    expect((await json(ok)).data.attributes.name).toBe('😀'.repeat(24));
    const tooLong = await create('😀'.repeat(25));
    expect(tooLong.status).toBe(400);
  });
});
