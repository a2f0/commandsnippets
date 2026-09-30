import {CURSOR_START} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Tag,
  type TagTextEntry,
  type TextEntry,
  type User,
  users,
} from '../../src/db/schema';
import {
  ApiClient,
  db,
  json,
  refreshEntry,
  refreshJunction,
  refreshTag,
  refreshUser,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  tokenFor,
  userFactory,
} from '../helpers';

// v2: staff read another user's data through the admin API, and can change
// none of it.
async function staffClient(): Promise<{staff: User; client: ApiClient}> {
  const staff = await userFactory(
    {username: 'staff', email: 'staff@example.com'},
    {examples: false}
  );
  await db().update(users).set({is_staff: true}).where(eq(users.id, staff.id));
  return {
    staff: (await refreshUser(staff.id)) as User,
    client: new ApiClient(await tokenFor(staff.id)),
  };
}

type Resource = {type: string; id: string};

const idsOf = (resources: Resource[] | undefined, type?: string) =>
  (resources ?? [])
    .filter(resource => type === undefined || resource.type === type)
    .map(resource => resource.id);

describe("AdminApi a user's data", () => {
  let staff: User;
  let client: ApiClient;
  let alice: User;
  let tag: Tag;
  let entry: TextEntry;
  let junction: TagTextEntry;
  let base: string;

  beforeEach(async () => {
    ({staff, client} = await staffClient());
    alice = await userFactory({username: 'alice'}, {examples: false});
    tag = await tagFactory({user: alice, name: 'alices-tag'});
    entry = await textEntryFactory({user: alice, subject: 'alices-entry'});
    junction = await tagTextEntryFactory({tag, text_entry: entry, user: alice});
    // Staff's own data, which none of alice's lists include.
    const own = await tagFactory({user: staff, name: 'staffs-tag'});
    const ownEntry = await textEntryFactory({user: staff});
    await tagTextEntryFactory({tag: own, text_entry: ownEntry, user: staff});
    base = `/api/v1/admin/users/${alice.id}`;
  });

  it("lists the user's tags, entries and junctions, and no one else's", async () => {
    const tags = await json(await client.get(`${base}/tags`));
    expect(idsOf(tags.data)).toEqual([String(tag.id)]);
    expect(idsOf(tags.included, 'User')).toEqual([String(alice.id)]);

    const entries = await json(
      await client.get(`${base}/entries?include=text_entry_to_tag`)
    );
    expect(idsOf(entries.data)).toEqual([String(entry.id)]);
    expect(idsOf(entries.included, 'TagTextEntryThroughModel')).toEqual([
      String(junction.id),
    ]);

    const junctions = await json(
      await client.get(
        `${base}/tags_entries?filter[tag.id]=${tag.id}&include=text_entry`
      )
    );
    expect(idsOf(junctions.data)).toEqual([String(junction.id)]);
    expect(idsOf(junctions.included, 'TextEntry')).toEqual([String(entry.id)]);
    expect(JSON.stringify([tags, entries, junctions])).not.toContain(
      'staffs-tag'
    );
  });

  it("pages by revision, as the user's own lists do", async () => {
    await tagFactory({user: alice, name: 'second'});

    const first = await json(
      await client.get(`${base}/tags?page[after]=${CURSOR_START}&page[size]=1`)
    );
    expect(idsOf(first.data)).toEqual([String(tag.id)]);
    expect(first.links.next).toEqual(
      expect.stringContaining('page%5Bafter%5D')
    );
    const next = new URL(first.links.next);
    const second = await json(
      await client.get(`${next.pathname}${next.search}`)
    );
    expect(
      second.data.map(
        (row: {attributes: {name: string}}) => row.attributes.name
      )
    ).toEqual(['second']);
    expect(second.links.next).toBeNull();

    const newest = await json(
      await client.get(`${base}/tags_entries?sort=-date_updated&page[size]=1`)
    );
    expect(idsOf(newest.data)).toEqual([String(junction.id)]);
  });

  it('404s for a user who does not exist', async () => {
    for (const path of [
      '/api/v1/admin/users/999999/tags',
      '/api/v1/admin/users/999999/entries',
      '/api/v1/admin/users/abc/tags_entries',
    ]) {
      expect((await client.get(path)).status).toBe(404);
    }
  });

  it('refuses users who are not staff, and anonymous requests', async () => {
    const bob = new ApiClient(
      await tokenFor(
        (await userFactory({username: 'bob'}, {examples: false})).id
      )
    );
    for (const path of ['tags', 'entries', 'tags_entries']) {
      const forbidden = await bob.get(`${base}/${path}`);
      expect(forbidden.status).toBe(403);
      expect((await json(forbidden)).errors[0].code).toBe('permission_denied');
      const anonymous = await new ApiClient().get(`${base}/${path}`);
      expect(anonymous.status).toBe(403);
      expect((await json(anonymous)).errors[0].code).toBe('not_authenticated');
    }
  });

  it('routes nothing that writes', async () => {
    const body = {data: {type: 'Tag', attributes: {name: 'x'}}};
    for (const response of [
      await client.post(`${base}/tags`, body),
      await client.patch(`${base}/tags`, body),
      await client.delete(`${base}/entries`),
      await client.post(`${base}/tags_entries`, body),
    ]) {
      expect(response.status).toBe(404);
    }
    expect((await refreshTag(tag.id))?.name).toBe('alices-tag');
  });

  it('finds a user by exact username', async () => {
    await userFactory({username: 'alice2'}, {examples: false});
    const found = await json(
      await client.get('/api/v1/admin/users?filter[username]=alice')
    );
    expect(idsOf(found.data)).toEqual([String(alice.id)]);
    const none = await json(
      await client.get('/api/v1/admin/users?filter[username]=ALICE')
    );
    expect(none.data).toEqual([]);
  });

  it("never lets staff change the user's data", async () => {
    const other = await tagFactory({user: alice, name: 'other'});
    const second = await tagTextEntryFactory({
      tag,
      text_entry: await textEntryFactory({user: alice}),
      user: alice,
      order: 1,
    });
    const before = {
      tag: await refreshTag(tag.id),
      entry: await refreshEntry(entry.id),
      junction: await refreshJunction(junction.id),
    };
    const refused = [
      await client.patch(`/api/v1/tags/${tag.id}`, {
        data: {type: 'Tag', id: String(tag.id), attributes: {name: 'renamed'}},
      }),
      await client.delete(`/api/v1/tags/${tag.id}`),
      await client.patch(`/api/v1/entries/${entry.id}`, {
        data: {
          type: 'TextEntry',
          id: String(entry.id),
          attributes: {subject: 'changed'},
        },
      }),
      await client.delete(`/api/v1/entries/${entry.id}`),
      await client.delete(`/api/v1/tags_entries/${junction.id}`),
      await client.post('/api/v1/tags_entries', {
        data: {
          type: 'TagTextEntryThroughModel',
          relationships: {
            tag: {data: {type: 'Tag', id: String(other.id)}},
            text_entry: {data: {type: 'TextEntry', id: String(entry.id)}},
          },
        },
      }),
      await client.post('/api/v1/tags/reorder', {
        data: {type: 'Tag', attributes: {top: other.id, bottom: tag.id}},
      }),
      await client.post('/api/v1/tags_entries/reorder', {
        data: {
          type: 'TagTextEntryThroughModel',
          attributes: {top: second.id, bottom: junction.id},
        },
      }),
    ];
    for (const response of refused) {
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(500);
    }
    expect(await refreshTag(tag.id)).toEqual(before.tag);
    expect(await refreshEntry(entry.id)).toEqual(before.entry);
    expect(await refreshJunction(junction.id)).toEqual(before.junction);
    expect(await refreshJunction(second.id)).toEqual(
      expect.objectContaining({order: 1, is_deleted: false})
    );
  });
});
