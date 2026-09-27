import {sql} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Base,
  db,
  entriesOf,
  isoformat,
  type Json,
  json,
  junctionsOf,
  refreshEntry,
  setUpBase,
  tagFactory,
  tagsOf,
  tagTextEntryFactory,
  textEntryFactory,
} from '../helpers';

const SEARCH_PARAM = 'filter[search]';
const q = encodeURIComponent;

/** Python's `str(datetime)`: isoformat with a space separator. */
const strDatetime = (stored: string) => isoformat(stored).replace('T', ' ');

const entryPayload = (attributes: Record<string, unknown>, id?: string) => ({
  data: {type: 'TextEntry', ...(id === undefined ? {} : {id}), attributes},
});

// tearleads/text_entries/tests/test_text_entries_api.py
describe('TestTextEntriesApi', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  it('test_serialization_format', async () => {
    const {user1, user1Client} = base;
    const [entry1] = await entriesOf(user1);
    const [tag1] = await tagsOf(user1);
    if (entry1 === undefined || tag1 === undefined) throw new Error('setup');
    const junctions = await junctionsOf(entry1);
    const tagsEntries1 = junctions[0];
    expect(junctions.length).toBe(1);
    if (tagsEntries1 === undefined) throw new Error('setup');

    const url =
      `/api/v1/entries/${entry1.id}?include=text_entry_to_tag.tag,` +
      'text_entry_to_tag.user,user';
    const response = await user1Client.get(url);
    const jsonResponse = await json(response);

    // Test main entry data
    const data = jsonResponse.data;
    expect(Object.keys(data).length).toBe(4);
    expect(data.id).toBe(String(entry1.id));

    const attributes = data.attributes;
    expect(Object.keys(attributes).length).toBe(7);
    expect(attributes.subject).toBe(entry1.subject);
    expect(attributes.body).toBe(entry1.body);
    expect(attributes.date_created).toBe(isoformat(entry1.date_created));
    expect(attributes.date_updated).toBe(isoformat(entry1.date_updated));
    expect(attributes.reused_count).toBe(entry1.reused_count);
    expect(attributes.is_deleted).toBe(entry1.is_deleted);
    expect(attributes.tag_count).toBe(entry1.tag_count);

    // Test included objects
    const included = jsonResponse.included;
    expect(included.length).toBe(3);

    // Test Tag (first included item)
    const tagData = included[0];
    expect(tagData.type).toBe('Tag');
    expect(Object.keys(tagData.attributes).length).toBe(7);
    expect(tagData.attributes.name).toBe(tag1.name);
    expect(tagData.attributes.date_created).toBe(isoformat(tag1.date_created));
    expect(tagData.attributes.date_last_used).toBe(
      isoformat(tag1.date_last_used)
    );
    expect(tagData.attributes.date_updated).toBe(isoformat(tag1.date_updated));
    expect(tagData.attributes.entry_count).toBe(tag1.entry_count);
    expect(tagData.attributes.order).toBe(tag1.order);
    expect(tagData.attributes.is_deleted).toBe(tag1.is_deleted);

    // Test Junction (second included item)
    const junctionData = included[1];
    expect(junctionData.type).toBe('TagTextEntryThroughModel');
    expect(junctionData.id).toBe(String(tagsEntries1.id));
    expect(Object.keys(junctionData.attributes).length).toBe(3);
    expect(junctionData.attributes.order).toBe(tagsEntries1.order);
    expect(junctionData.attributes.date_updated).toBe(
      isoformat(tagsEntries1.date_updated)
    );
    expect(junctionData.attributes.date_created).toBe(
      isoformat(tagsEntries1.date_created)
    );

    // Test User (third included item)
    const userData = included[2];
    expect(userData.type).toBe('User');
    expect(userData.id).toBe(String(entry1.user_id));
    expect(Object.keys(userData.attributes).length).toBe(2);
    expect(userData.attributes.username).toBe(user1.username);
    expect(userData.attributes.date_updated).toBe(
      isoformat(user1.date_updated)
    );
  });

  it('test_pagination', async () => {
    const {user1, user1Client} = base;
    const entries = await entriesOf(user1);
    const entry1 = entries[0];
    const entry2 = entries[entries.length - 1];

    expect(entries.length).toBe(2);

    let response = await user1Client.get(
      `/api/v1/entries?page[number]=1&page[size]=1&filter[user.username]=${user1.username}`
    );
    let jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry1?.id));
    expect(jsonResponse.meta.pagination.count).toBe(2);

    response = await user1Client.get(
      `/api/v1/entries?page[number]=2&page[size]=1&filter[user.username]=${user1.username}`
    );
    jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry2?.id));
    expect(jsonResponse.meta.pagination.count).toBe(2);
  });

  it('test_no_filter', async () => {
    // v2: reads are owner-only, so this lists user1's entries (Django listed
    // every user's entries here).
    const response = await base.user1Client.get('/api/v1/entries');
    const jsonResponse = await json(response);

    expect(response.status).toBe(200);
    expect(Object.keys(jsonResponse.data[0]).length).not.toBe(0);
    expect(
      jsonResponse.data.every(
        (entry: Json) =>
          entry.relationships.user.data.id === String(base.user1.id)
      )
    ).toBe(true);
  });

  it('test_bad_filter', async () => {
    // invalid filter
    const response = await base.user1Client.get(
      '/api/v1/entries?filter[bad]=1'
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe('invalid filter[bad]');
  });

  it('test_filter_by_id', async () => {
    // filter by single id
    const {user1, user1Client} = base;
    const entry1 = await textEntryFactory({user: user1});
    const entry2 = await textEntryFactory({user: user1});
    let response = await user1Client.get(
      `/api/v1/entries?filter[id]=${entry1.id}`
    );
    let jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data[0].id).toBe(String(entry1.id));
    response = await user1Client.get(`/api/v1/entries?filter[id]=${entry2.id}`);
    jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data[0].id).toBe(String(entry2.id));
  });

  it('test_filter_by_tag_name', async () => {
    const {user1, user1Client} = base;
    const entry1 = await textEntryFactory({user: user1});
    const tag1 = await tagFactory({user: user1, name: 'zzz'});
    await tagTextEntryFactory({text_entry: entry1, tag: tag1, user: user1});
    let response = await user1Client.get(
      '/api/v1/entries?filter[tags.name]=zzz'
    );
    let jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry1.id));
    // make sure a tag of yyy returns no results
    response = await user1Client.get('/api/v1/entries?filter[tags.name]=yyy');
    jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(0);
  });

  it('test_filter_by_tag_id', async () => {
    const {user1, user1Client} = base;
    const entry1 = await textEntryFactory({user: user1});
    const tag1 = await tagFactory({user: user1});
    await tagTextEntryFactory({text_entry: entry1, tag: tag1, user: user1});
    const response = await user1Client.get(
      `/api/v1/entries?filter[tags.id]=${tag1.id}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry1.id));
  });

  it('test_filter_by_tag_count', async () => {
    const {user1, user1Client} = base;
    const entries = await entriesOf(user1);
    const entry1 = entries[entries.length - 1];
    const response = await user1Client.get(
      `/api/v1/entries?filter[tag_count]=2&filter[user.username]=${user1.username}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry1?.id));
  });

  it('test_filter_by_is_deleted', async () => {
    const {user1, user1Client} = base;
    let response = await user1Client.get(
      `/api/v1/entries?filter[is_deleted]=0&filter[user.username]=${user1.username}`
    );
    let jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(2);
    response = await user1Client.get(
      `/api/v1/entries?filter[is_deleted]=1&filter[user.username]=${user1.username}`
    );
    jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(0);
  });

  it('test_filter_by_username', async () => {
    const {user1, user1Client} = base;
    const [entry1] = await entriesOf(user1);

    // Test filtering by valid username
    let response = await user1Client.get(
      `/api/v1/entries?filter[user.username]=${user1.username}`
    );
    let jsonResponse = await json(response);
    expect(response.status).toBe(200);
    const data = jsonResponse.data;
    expect(data.length).toBe(2);
    expect(data[0].id).toBe(String(entry1?.id));

    // Test filtering by invalid username
    response = await user1Client.get(
      '/api/v1/entries?filter[user.username]=random'
    );
    jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(0);
  });

  it('test_filter_by_date_updated_gt', async () => {
    const {user1, user1Client} = base;
    const entries = await entriesOf(user1);
    const entry1 = entries[0];
    const entry2 = entries[entries.length - 1];
    if (entry1 === undefined) throw new Error('setup');
    const response = await user1Client.get(
      `/api/v1/entries?filter[date_updated.gt]=${q(strDatetime(entry1.date_updated))}` +
        `&filter[user.username]=${user1.username}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry2?.id));
  });

  it('test_order_filter', async () => {
    const {user1, user1Client} = base;
    const entries = await entriesOf(user1);
    const entry1 = entries[0];
    const entry2 = entries[entries.length - 1];
    if (entry1 === undefined || entry2 === undefined) throw new Error('setup');

    // Test invalid sort key
    let response = await user1Client.get(
      '/api/v1/entries?sort=invalid_sort_key'
    );
    let jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe(
      'invalid sort parameter: invalid_sort_key'
    );

    // Test sorting by different fields
    const sortTests: Array<[string, number, number]> = [
      // (sort_param, expected_first_id, expected_second_id)
      ['body', entry2.id, entry1.id],
      ['-body', entry1.id, entry2.id],
      ['date_created', entry1.id, entry2.id],
      ['-date_created', entry2.id, entry1.id],
      ['date_updated', entry1.id, entry2.id],
      ['-date_updated', entry2.id, entry1.id],
      ['subject', entry1.id, entry2.id],
      ['-subject', entry2.id, entry1.id],
    ];

    for (const [sortParam, expectedFirstId, expectedSecondId] of sortTests) {
      response = await user1Client.get(
        `/api/v1/entries?sort=${sortParam}&filter[user.username]=${user1.username}`
      );
      jsonResponse = await json(response);
      expect(response.status).toBe(200);
      expect(jsonResponse.data.length).toBe(2);
      expect(jsonResponse.data[0].id).toBe(String(expectedFirstId));
      expect(jsonResponse.data[1].id).toBe(String(expectedSecondId));
    }
  });

  it('test_create_entry_works_for_authenticated_user', async () => {
    const {user1, user1Client} = base;
    const payload = entryPayload({subject: 'subject', body: 'body'});
    const response = await user1Client.post('/api/v1/entries', payload);
    const jsonResponse = await json(response);

    // Test main response
    expect(response.status).toBe(201);
    expect(jsonResponse.data.attributes.subject).toBe(
      payload.data.attributes.subject
    );
    expect(jsonResponse.data.attributes.body).toBe(
      payload.data.attributes.body
    );

    // Test included user data
    const included = jsonResponse.included;
    expect(included.length).toBe(1);
    const userData = included[0];
    expect(userData.type).toBe('User');
    expect(Object.keys(userData.attributes).length).toBe(2);
    expect(userData.attributes.username).toBe(user1.username);
    expect(userData.attributes.date_updated).toBe(
      isoformat(user1.date_updated)
    );
  });

  it('test_body_too_large', async () => {
    const maxLength = 1024;
    const payload = entryPayload({
      subject: 'subject',
      body: 'x'.repeat(maxLength + 1),
    });
    const response = await base.user1Client.post('/api/v1/entries', payload);
    const jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe(
      `Ensure this field has no more than ${maxLength} characters.`
    );
  });

  it('test_subject_too_large', async () => {
    const maxLength = 255;
    const payload = entryPayload({
      subject: 'x'.repeat(maxLength + 1),
      body: 'body',
    });
    const response = await base.user1Client.post('/api/v1/entries', payload);
    const jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe(
      `Ensure this field has no more than ${maxLength} characters.`
    );
  });

  it('test_create_entry_fails_for_unauthenticated_user', async () => {
    const payload = entryPayload({subject: 'subject', body: 'body'});
    const response = await base.unauthenticatedClient.post(
      '/api/v1/entries',
      payload
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(403);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe(
      'Authentication credentials were not provided.'
    );
  });

  it('test_edit_works_when_modifying_self_owned_object', async () => {
    const {user1, user1Client} = base;
    const entry1 = await textEntryFactory({user: user1});
    const payload = entryPayload(
      {subject: 'new subject', body: 'new body'},
      String(entry1.id)
    );
    const response = await user1Client.patch(
      `/api/v1/entries/${entry1.id}`,
      payload
    );
    const jsonResponse = await json(response);

    // Test main response
    expect(response.status).toBe(200);
    expect(jsonResponse.data.attributes.subject).toBe(
      payload.data.attributes.subject
    );
    expect(jsonResponse.data.attributes.body).toBe(
      payload.data.attributes.body
    );

    // Test included user data
    const included = jsonResponse.included;
    expect(included.length).toBe(1);
    const userData = included[0];
    expect(userData.type).toBe('User');
    expect(Object.keys(userData.attributes).length).toBe(2);
    expect(userData.attributes.username).toBe(user1.username);
    expect(userData.attributes.date_updated).toBe(
      isoformat(user1.date_updated)
    );
  });

  it('test_delete_works_when_self_owns_object', async () => {
    const {user1, user1Client} = base;
    const entry = await textEntryFactory({user: user1, is_deleted: false});
    expect(entry.is_deleted).toBe(false);

    const response = await user1Client.delete(`/api/v1/entries/${entry.id}`);
    const jsonResponse = await json(response);

    // Test main response
    expect(response.status).toBe(200);
    expect(jsonResponse.data.attributes.is_deleted).toBe(true);

    // Test included user data
    const included = jsonResponse.included;
    expect(included.length).toBe(1);
    const userData = included[0];
    expect(userData.type).toBe('User');
    expect(Object.keys(userData.attributes).length).toBe(2);
    expect(userData.attributes.username).toBe(user1.username);
    expect(userData.attributes.date_updated).toBe(
      isoformat(user1.date_updated)
    );
  });

  it('test_delete_fails_when_object_owned_by_other', async () => {
    const entry1 = await textEntryFactory({
      user: base.user2,
      is_deleted: false,
    });
    const response = await base.user1Client.delete(
      `/api/v1/entries/${entry1.id}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(403);
    expect(jsonResponse.errors[0].detail).toBe(
      'You do not have permission to perform this action.'
    );
  });

  it('test_delete_fails_for_anonymous_user', async () => {
    const entry1 = await textEntryFactory({
      user: base.user2,
      is_deleted: false,
    });
    const response = await base.unauthenticatedClient.delete(
      `/api/v1/entries/${entry1.id}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(403);
    expect(jsonResponse.errors[0].detail).toBe(
      'Authentication credentials were not provided.'
    );
  });

  it('test_search_by_body', async () => {
    const {user1, user1Client} = base;
    const [entry1] = await entriesOf(user1);
    const response = await user1Client.get(
      `/api/v1/entries?${SEARCH_PARAM}=pg_terminate_backend&filter[user.username]=${user1.username}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry1?.id));
  });

  it('test_search_by_subject', async () => {
    const {user1, user1Client} = base;
    const [entry1] = await entriesOf(user1);
    const response = await user1Client.get(
      `/api/v1/entries?${SEARCH_PARAM}=${q('close all postgres connections')}` +
        `&filter[user.username]=${user1.username}`
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(1);
    expect(jsonResponse.data[0].id).toBe(String(entry1?.id));
  });
});

// v2-specific behavior (owner-only reads, validation, query-param handling).
describe('TextEntriesApi v2', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  const expectError = async (
    response: Response,
    status: number,
    detail: string
  ) => {
    const jsonResponse = await json(response);
    expect(response.status).toBe(status);
    expect(jsonResponse.errors.length).toBe(1);
    expect(jsonResponse.errors[0].detail).toBe(detail);
    return jsonResponse;
  };

  it('rejects anonymous list and retrieve', async () => {
    const [entry] = await entriesOf(base.user1);
    await expectError(
      await base.unauthenticatedClient.get('/api/v1/entries'),
      403,
      'Authentication credentials were not provided.'
    );
    await expectError(
      await base.unauthenticatedClient.get(`/api/v1/entries/${entry?.id}`),
      403,
      'Authentication credentials were not provided.'
    );
  });

  it("never lists another user's entries", async () => {
    const {user1Client, user2} = base;
    const other = await textEntryFactory({user: user2});
    const user2Entries = await entriesOf(user2);

    const response = await user1Client.get('/api/v1/entries?page[size]=100');
    const ids = (await json(response)).data.map((entry: Json) => entry.id);
    expect(response.status).toBe(200);
    for (const entry of user2Entries) {
      expect(ids).not.toContain(String(entry.id));
    }

    const filtered = await json(
      await user1Client.get(
        `/api/v1/entries?filter[user.username]=${user2.username}`
      )
    );
    expect(filtered.data.length).toBe(0);

    const byId = await json(
      await user1Client.get(`/api/v1/entries?filter[id]=${other.id}`)
    );
    expect(byId.data.length).toBe(0);
  });

  it("forbids retrieving another user's entry", async () => {
    const other = await textEntryFactory({user: base.user2});
    await expectError(
      await base.user1Client.get(`/api/v1/entries/${other.id}`),
      403,
      'You do not have permission to perform this action.'
    );
  });

  it('retrieves an owned entry with default includes', async () => {
    const [entry] = await entriesOf(base.user1);
    const response = await base.user1Client.get(`/api/v1/entries/${entry?.id}`);
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.id).toBe(String(entry?.id));
    expect(jsonResponse.data.relationships.text_entry_to_tag.meta.count).toBe(
      1
    );
    const types = jsonResponse.included.map((item: Json) => item.type);
    expect(types).toEqual(['Tag', 'TagTextEntryThroughModel', 'User']);
  });

  it('returns 404 for missing and non-numeric ids', async () => {
    const {user1Client} = base;
    for (const id of ['999999', 'abc']) {
      await expectError(
        await user1Client.get(`/api/v1/entries/${id}`),
        404,
        'No TextEntry matches the given query.'
      );
      await expectError(
        await user1Client.delete(`/api/v1/entries/${id}`),
        404,
        'No TextEntry matches the given query.'
      );
    }
  });

  it('escapes LIKE wildcards and searches case-insensitively', async () => {
    const {user1, user1Client} = base;
    const percent = await textEntryFactory({
      user: user1,
      body: 'done 100% now',
    });
    await textEntryFactory({user: user1, body: 'done 1000 now'});
    const underscore = await textEntryFactory({user: user1, subject: 'a_b'});
    await textEntryFactory({user: user1, subject: 'axb'});
    const upper = await textEntryFactory({user: user1, subject: 'MiXeD CaSe'});

    const search = async (term: string) =>
      (
        await json(
          await user1Client.get(`/api/v1/entries?${SEARCH_PARAM}=${q(term)}`)
        )
      ).data.map((entry: Json) => entry.id);

    expect(await search('100%')).toEqual([String(percent.id)]);
    expect(await search('a_b')).toEqual([String(underscore.id)]);
    expect(await search('mixed case')).toEqual([String(upper.id)]);
    expect(await search('%')).toEqual([String(percent.id)]);
  });

  it('rejects invalid filter values', async () => {
    const {user1Client} = base;
    await expectError(
      await user1Client.get('/api/v1/entries?filter[id]=abc'),
      400,
      'Enter a number.'
    );
    await expectError(
      await user1Client.get('/api/v1/entries?filter[tag_count]=two'),
      400,
      'Enter a number.'
    );
    await expectError(
      await user1Client.get('/api/v1/entries?filter[tags.id]=x'),
      400,
      'Enter a number.'
    );
    await expectError(
      await user1Client.get('/api/v1/entries?filter[is_deleted]=maybe'),
      400,
      'Enter a valid boolean.'
    );
    await expectError(
      await user1Client.get(
        '/api/v1/entries?filter[date_updated.gt]=yesterday'
      ),
      400,
      'Enter a valid date/time.'
    );
    await expectError(
      await user1Client.get('/api/v1/entries?filter[tag_count]='),
      400,
      'missing value for query parameter filter[tag_count]'
    );
  });

  it('accepts true/false for filter[is_deleted]', async () => {
    const {user1, user1Client} = base;
    const deleted = await textEntryFactory({user: user1, is_deleted: true});
    const response = await user1Client.get(
      '/api/v1/entries?filter[is_deleted]=true'
    );
    const jsonResponse = await json(response);
    expect(jsonResponse.data.map((entry: Json) => entry.id)).toEqual([
      String(deleted.id),
    ]);
    const notDeleted = await json(
      await user1Client.get('/api/v1/entries?filter[is_deleted]=false')
    );
    expect(notDeleted.data.length).toBe(2);
  });

  it('accepts str(datetime), ISO T, Z and offset forms for date_updated.gt', async () => {
    const {user1, user1Client} = base;
    const entries = await entriesOf(user1);
    const entry1 = entries[0];
    const entry2 = entries[1];
    if (entry1 === undefined || entry2 === undefined) throw new Error('setup');
    const stored = entry1.date_updated;

    // The same instant expressed at +02:00.
    const shifted = new Date(
      Date.parse(`${stored.slice(0, 23)}Z`) + 2 * 3600_000
    )
      .toISOString()
      .slice(0, 19);
    const plusTwo = `${shifted}.${stored.slice(20)}+02:00`;

    for (const value of [
      strDatetime(stored),
      isoformat(stored),
      `${stored}Z`,
      `${stored}+00:00`,
      plusTwo,
    ]) {
      const response = await user1Client.get(
        `/api/v1/entries?filter[date_updated.gt]=${q(value)}`
      );
      const jsonResponse = await json(response);
      expect(response.status, value).toBe(200);
      expect(
        jsonResponse.data.map((entry: Json) => entry.id),
        value
      ).toEqual([String(entry2.id)]);
    }
  });

  it('caps page[size] at 100 and 404s on invalid pages', async () => {
    const {user1, user1Client} = base;
    // user1 has 2 entries; add 99 more in one statement.
    await db().run(sql`
      WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n WHERE i < 99)
      INSERT INTO text_entries_textentry (body, subject, date_created, date_updated, user_id)
      SELECT 'bulk-' || i, 'bulk-' || i, '2020-01-01T00:00:00.000000',
             '2020-01-01T00:00:00.000000', ${user1.id} FROM n
    `);

    const response = await user1Client.get('/api/v1/entries?page[size]=500');
    const jsonResponse = await json(response);
    expect(response.status).toBe(200);
    expect(jsonResponse.data.length).toBe(100);
    expect(jsonResponse.meta.pagination).toEqual({
      page: 1,
      pages: 2,
      count: 101,
    });
    expect(jsonResponse.links.next).toContain('page%5Bnumber%5D=2');
    expect(jsonResponse.links.prev).toBeNull();

    const defaultPage = await json(await user1Client.get('/api/v1/entries'));
    expect(defaultPage.data.length).toBe(50);

    for (const page of ['99', '0', 'abc']) {
      await expectError(
        await user1Client.get(`/api/v1/entries?page[number]=${page}`),
        404,
        'Invalid page.'
      );
    }
  });

  it('rejects invalid include paths', async () => {
    const [entry] = await entriesOf(base.user1);
    await expectError(
      await base.user1Client.get(`/api/v1/entries/${entry?.id}?include=bogus`),
      400,
      'This endpoint does not support the include parameter for path bogus'
    );
    await expectError(
      await base.user1Client.get(
        '/api/v1/entries?include=text_entry_to_tag.nope'
      ),
      400,
      'This endpoint does not support the include parameter for path text_entry_to_tag.nope'
    );
  });

  it('rejects repeated sort and unknown query parameters', async () => {
    await expectError(
      await base.user1Client.get('/api/v1/entries?sort=subject&sort=body'),
      400,
      'repeated query parameter not allowed: sort'
    );
    await expectError(
      await base.user1Client.get('/api/v1/entries?foo=bar'),
      400,
      'invalid query parameter: foo'
    );
    await expectError(
      await base.user1Client.get('/api/v1/entries?sort=nope,alsonope'),
      400,
      'invalid sort parameters: nope,alsonope'
    );
  });

  it('validates PATCH attributes and the document id', async () => {
    const {user1, user1Client} = base;
    const entry = await textEntryFactory({user: user1});
    const url = `/api/v1/entries/${entry.id}`;

    const oversized = await expectError(
      await user1Client.patch(
        url,
        entryPayload({subject: 'x'.repeat(256)}, String(entry.id))
      ),
      400,
      'Ensure this field has no more than 255 characters.'
    );
    expect(oversized.errors[0].source.pointer).toBe('/data/attributes/subject');

    await expectError(
      await user1Client.patch(url, entryPayload({body: ''}, String(entry.id))),
      400,
      'This field may not be blank.'
    );

    await expectError(
      await user1Client.patch(
        url,
        entryPayload({body: 'x'}, String(entry.id + 1))
      ),
      409,
      `The resource object's id (${entry.id + 1}) does not match the endpoint's id (${entry.id}).`
    );

    await expectError(
      await user1Client.patch(url, entryPayload({body: 'x'})),
      400,
      "The resource identifier object must contain an 'id' member"
    );

    // Unchanged after the failed updates.
    expect((await refreshEntry(entry.id))?.subject).toBe(entry.subject);
  });

  it('PATCH can soft-delete and PUT updates like PATCH', async () => {
    const {user1, user1Client} = base;
    const entry = await textEntryFactory({user: user1});
    const url = `/api/v1/entries/${entry.id}`;

    let response = await user1Client.patch(
      url,
      entryPayload({is_deleted: true}, String(entry.id))
    );
    expect(response.status).toBe(200);
    expect((await json(response)).data.attributes.is_deleted).toBe(true);

    response = await user1Client.put(
      url,
      entryPayload({subject: 'put subject'}, String(entry.id))
    );
    expect(response.status).toBe(200);
    const refreshed = await refreshEntry(entry.id);
    expect(refreshed?.subject).toBe('put subject');
    expect((refreshed?.date_updated ?? '') > entry.date_updated).toBe(true);
  });

  it("cannot PATCH another user's entry", async () => {
    const other = await textEntryFactory({user: base.user2});
    await expectError(
      await base.user1Client.patch(
        `/api/v1/entries/${other.id}`,
        entryPayload({subject: 'hijack'}, String(other.id))
      ),
      403,
      'You do not have permission to perform this action.'
    );
    expect((await refreshEntry(other.id))?.subject).toBe(other.subject);
  });

  it('rejects POST documents with the wrong type or no data', async () => {
    const {user1Client} = base;
    await expectError(
      await user1Client.post('/api/v1/entries', {
        data: {type: 'Tag', attributes: {subject: 's', body: 'b'}},
      }),
      409,
      "The resource object's type (Tag) is not the type that constitute the " +
        'collection represented by the endpoint (TextEntry).'
    );
    await expectError(
      await user1Client.post('/api/v1/entries', {}),
      400,
      'Received document does not contain primary data'
    );
  });

  it('requires subject and body on create', async () => {
    const response = await base.user1Client.post(
      '/api/v1/entries',
      entryPayload({})
    );
    const jsonResponse = await json(response);
    expect(response.status).toBe(400);
    expect(
      jsonResponse.errors.map((error: Json) => [
        error.source.pointer,
        error.detail,
      ])
    ).toEqual([
      ['/data/attributes/body', 'This field is required.'],
      ['/data/attributes/subject', 'This field is required.'],
    ]);
  });

  it('creates an entry owned by the requester, ignoring a user relationship', async () => {
    const {user1Client, user1, user2} = base;
    const response = await user1Client.post('/api/v1/entries', {
      data: {
        type: 'TextEntry',
        attributes: {subject: 'mine', body: 'body'},
        relationships: {user: {data: {type: 'User', id: String(user2.id)}}},
      },
    });
    const jsonResponse = await json(response);
    expect(response.status).toBe(201);
    expect(jsonResponse.data.relationships.user.data.id).toBe(String(user1.id));
  });
});
