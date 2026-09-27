import {describe, expect, it} from 'vitest';
import {
  json,
  refreshJunction,
  setUpBase,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  textEntryReusedFactory,
} from '../helpers';

type Resource = {type: string; id: string; attributes: Record<string, unknown>};

const ids = (resources: Resource[] | undefined, type: string) =>
  (resources ?? []).filter(r => r.type === type).map(r => r.id);

// Django never checked ownership when recording reuses or tagging, so imported
// data can link one user's rows to another's. These rows are created directly
// (as the import would) and must never leak through `include`.
describe('cross-user relationships from legacy data', () => {
  it("does not include another user's entry through a reuse", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const foreign = await textEntryFactory({user: user2, body: 'secret'});
    const reuse = await textEntryReusedFactory({
      text_entry: foreign,
      user: user1,
    });

    for (const path of [
      `/api/v1/entry_reuses/${reuse.id}?include=text_entry,user`,
      '/api/v1/entry_reuses?include=text_entry,user',
    ]) {
      const response = await user1Client.get(path);
      expect(response.status).toBe(200);
      const body = await json(response);
      const text = JSON.stringify(body);
      expect(text).not.toContain('secret');
      expect(ids(body.included, 'TextEntry')).toEqual([]);
      expect(ids(body.included, 'User')).toEqual([String(user1.id)]);
    }
  });

  it("hides another user's junctions on an entry and their tags", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    const foreignTag = await tagFactory({user: user2, name: 'their-tag'});
    const foreignJunction = await tagTextEntryFactory({
      tag: foreignTag,
      text_entry: entry,
      user: user2,
    });

    const response = await user1Client.get(`/api/v1/entries/${entry.id}`);
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(
      body.data.relationships.text_entry_to_tag.data.map(
        (r: {id: string}) => r.id
      )
    ).not.toContain(String(foreignJunction.id));
    expect(ids(body.included, 'TagTextEntryThroughModel')).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('their-tag');
  });

  it("does not include another user's tag through the requester's junction", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    const foreignTag = await tagFactory({user: user2, name: 'their-tag'});
    const junction = await tagTextEntryFactory({
      tag: foreignTag,
      text_entry: entry,
      user: user1,
    });

    const response = await user1Client.get(
      `/api/v1/entries/${entry.id}?include=text_entry_to_tag.tag,text_entry_to_tag.user`
    );
    expect(response.status).toBe(200);
    const body = await json(response);
    expect(ids(body.included, 'TagTextEntryThroughModel')).toEqual([
      String(junction.id),
    ]);
    expect(ids(body.included, 'Tag')).toEqual([]);
    expect(JSON.stringify(body)).not.toContain('their-tag');
  });
});

describe('filters over cross-user relationships from legacy data', () => {
  it("does not match entries by another user's tag", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    const foreignTag = await tagFactory({user: user2, name: 'their-tag'});
    // Both the junction owned by the other user and one owned by the requester.
    await tagTextEntryFactory({
      tag: foreignTag,
      text_entry: entry,
      user: user2,
    });
    const own = await textEntryFactory({user: user1});
    await tagTextEntryFactory({tag: foreignTag, text_entry: own, user: user1});

    for (const filter of [
      'filter[tags.name]=their-tag',
      `filter[tags.id]=${foreignTag.id}`,
    ]) {
      const response = await user1Client.get(`/api/v1/entries?${filter}`);
      expect(response.status).toBe(200);
      expect((await json(response)).data).toEqual([]);
    }
  });

  it("still matches the requester's own tags", async () => {
    const {user1, user1Client} = await setUpBase();
    const entry = await textEntryFactory({user: user1});
    const tag = await tagFactory({user: user1, name: 'mine'});
    await tagTextEntryFactory({tag, text_entry: entry, user: user1});
    const response = await user1Client.get(
      '/api/v1/entries?filter[tags.name]=mine'
    );
    expect((await json(response)).data.map((r: {id: string}) => r.id)).toEqual([
      String(entry.id),
    ]);
  });
});

describe('tagging over a legacy junction owned by someone else', () => {
  it("takes over the junction between the requester's own tag and entry", async () => {
    const {user1, user2, user1Client} = await setUpBase();
    const tag = await tagFactory({user: user1});
    const entry = await textEntryFactory({user: user1});
    const legacy = await tagTextEntryFactory({
      tag,
      text_entry: entry,
      user: user2,
    });

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
    const body = await json(response);
    expect(body.data.id).toBe(String(legacy.id));
    expect(body.data.relationships.user.data.id).toBe(String(user1.id));
    expect(ids(body.included, 'User')).toEqual([String(user1.id)]);
    expect(JSON.stringify(body)).not.toContain(user2.username);
    expect((await refreshJunction(legacy.id))?.user_id).toBe(user1.id);
  });
});
