import {
  CODES,
  CURSOR_START,
  DATA_ACCESS_HEADER,
  DATA_OWNER_ID_HEADER,
  dataOwnerDocumentSchema,
  PUBLIC_REVISION_HEADER,
  tagListDocumentSchema,
  textEntryListDocumentSchema,
} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {
  type Tag,
  type TextEntry,
  tags,
  tagsEntries,
  textEntries,
  type User,
  users,
} from '../../src/db/schema';
import {
  ApiClient,
  db,
  json,
  raceBeforeStatement,
  refreshUser,
  tagFactory,
  tagTextEntryFactory,
  textEntryFactory,
  tokenFor,
  userFactory,
} from '../helpers';

describe('user-scoped public reads', () => {
  let owner: User;
  let client: ApiClient;
  let visibleTag: Tag;
  let hiddenTag: Tag;
  let visibleEntry: TextEntry;
  let hiddenEntry: TextEntry;
  let path: string;
  beforeEach(async () => {
    owner = await userFactory({username: 'alice'}, {examples: false});
    client = new ApiClient(await tokenFor(owner.id));
    visibleTag = await tagFactory({user: owner, name: 'public'});
    hiddenTag = await tagFactory({user: owner, name: 'secret-tag'});
    visibleEntry = await textEntryFactory({
      user: owner,
      subject: 'public-entry',
    });
    hiddenEntry = await textEntryFactory({
      user: owner,
      subject: 'secret-entry',
    });
    await tagTextEntryFactory({
      user: owner,
      tag: visibleTag,
      text_entry: visibleEntry,
    });
    await tagTextEntryFactory({
      user: owner,
      tag: hiddenTag,
      text_entry: visibleEntry,
    });
    await tagTextEntryFactory({
      user: owner,
      tag: visibleTag,
      text_entry: hiddenEntry,
    });
    await db()
      .update(tags)
      .set({is_public: true})
      .where(eq(tags.id, visibleTag.id));
    await db()
      .update(textEntries)
      .set({is_public: true})
      .where(eq(textEntries.id, visibleEntry.id));
    path = '/api/v1/users/alice';
  });
  const ids = (rows: Array<{id: string}>) => rows.map(row => row.id);
  const revision = async () =>
    (await refreshUser(owner.id))?.public_revision ?? -1;

  it('defaults all creations to private and advances normal revisions on visibility edits', async () => {
    expect(hiddenTag.is_public).toBe(false);
    expect(hiddenEntry.is_public).toBe(false);
    const createdTag = await json(
      await client.post('/api/v1/tags', {
        data: {type: 'Tag', attributes: {name: 'new'}},
      })
    );
    const createdEntry = await json(
      await client.post('/api/v1/entries', {
        data: {type: 'TextEntry', attributes: {subject: 'new', body: 'body'}},
      })
    );
    expect(createdTag.data.attributes.is_public).toBe(false);
    expect(createdEntry.data.attributes.is_public).toBe(false);
    for (const [resource, row, type] of [
      ['tags', hiddenTag, 'Tag'],
      ['entries', hiddenEntry, 'TextEntry'],
    ] as const) {
      const before = await revision();
      const response = await client.patch(`/api/v1/${resource}/${row.id}`, {
        data: {type, id: String(row.id), attributes: {is_public: true}},
      });
      expect(response.status).toBe(200);
      const body = await json(response);
      expect(body.data.attributes.is_public).toBe(true);
      expect(body.data.attributes.date_updated > row.date_updated).toBe(true);
      expect(await revision()).toBeGreaterThan(before);
    }
  });

  it('gives guests public rows and excludes hidden relationship linkage, includes, and counts', async () => {
    const guest = new ApiClient();
    const response = await guest.get(
      `${path}/entries?include=text_entry_to_tag,text_entry_to_tag.tag,user`
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = textEntryListDocumentSchema.parse(await json(response));
    expect(ids(body.data)).toEqual([String(visibleEntry.id)]);
    expect(body.data[0]?.attributes.tag_count).toBe(1);
    expect(body.data[0]?.attributes.client_id).toBeNull();
    expect(body.data[0]?.attributes.reused_count).toBe(0);
    expect(body.data[0]?.relationships.text_entry_to_tag.data).toHaveLength(1);
    expect(JSON.stringify(body)).not.toContain('secret-');
    const listed = tagListDocumentSchema.parse(
      await json(await guest.get(`${path}/tags`))
    );
    expect(ids(listed.data)).toEqual([String(visibleTag.id)]);
    expect(listed.data[0]?.attributes.entry_count).toBe(1);
    expect(body.meta.pagination.count).toBe(1);
    const junctions = await json(
      await guest.get(
        `${path}/tags_entries?include=text_entry,text_entry.text_entry_to_tag,tag`
      )
    );
    expect(junctions.data).toHaveLength(1);
    expect(JSON.stringify(junctions)).not.toContain('secret-');
    expect(
      (
        await json(
          await guest.get(`${path}/entries?filter[tags.id]=${hiddenTag.id}`)
        )
      ).data
    ).toEqual([]);
    expect(
      (
        await json(
          await guest.get(`${path}/entries?filter[tags.name]=secret-tag`)
        )
      ).data
    ).toEqual([]);
    expect(
      (await json(await guest.get(`${path}/entries?filter[tag_count]=2`))).data
    ).toEqual([]);
    expect(
      (await json(await guest.get(`${path}/entries?filter[tag_count]=1`))).data
    ).toHaveLength(1);
    expect(
      (await guest.get(`${path}/tags?sort=entry_count,date_last_used`)).status
    ).toBe(200);
  });

  it('lets owner and staff see full data on the same endpoint while strangers see filtered data', async () => {
    const staff = await userFactory({username: 'staff'}, {examples: false});
    await db()
      .update(users)
      .set({is_staff: true})
      .where(eq(users.id, staff.id));
    const stranger = await userFactory({username: 'bob'}, {examples: false});
    for (const reader of [client, new ApiClient(await tokenFor(staff.id))]) {
      expect(
        (await json(await reader.get(`${path}/entries`))).data
      ).toHaveLength(2);
      expect((await json(await reader.get(`${path}/tags`))).data).toHaveLength(
        2
      );
      expect(
        (await json(await reader.get(`${path}/tags_entries`))).data
      ).toHaveLength(3);
      const metadata = dataOwnerDocumentSchema.parse(
        await json(await reader.get(path))
      );
      expect(metadata.data.attributes.access).toBe('full');
      expect(
        (
          await json(
            await reader.get(`${path}/entries`, {
              [DATA_ACCESS_HEADER]: 'public',
            })
          )
        ).data
      ).toHaveLength(1);
    }
    expect(
      (
        await json(
          await new ApiClient(await tokenFor(stranger.id)).get(
            `${path}/entries`
          )
        )
      ).data
    ).toHaveLength(1);
    const metadata = await json(await new ApiClient().get(path));
    expect(Object.keys(metadata.data.attributes).sort()).toEqual([
      'access',
      'public_revision',
      'username',
    ]);
    expect(metadata.data.attributes.access).toBe('public');
    expect(
      (await new ApiClient().get(path, {[DATA_ACCESS_HEADER]: 'full'})).status
    ).toBe(409);
    expect((await new ApiClient().get('/api/v1/admin/users')).status).toBe(403);
    expect((await new ApiClient().post(`${path}/entries`, {})).status).toBe(
      404
    );
  });

  it('shows an entry once with multiple public tags, and hides it when its last public tag is removed', async () => {
    const guest = new ApiClient();
    await db()
      .update(tags)
      .set({is_public: true})
      .where(eq(tags.id, hiddenTag.id));
    expect((await json(await guest.get(`${path}/entries`))).data).toHaveLength(
      1
    );
    await db()
      .update(tags)
      .set({is_public: false})
      .where(eq(tags.id, visibleTag.id));
    expect((await json(await guest.get(`${path}/entries`))).data).toHaveLength(
      1
    );
    await db()
      .update(tags)
      .set({is_public: false})
      .where(eq(tags.id, hiddenTag.id));
    expect((await json(await guest.get(`${path}/entries`))).data).toEqual([]);
    const orphan = await textEntryFactory({user: owner});
    await db()
      .update(textEntries)
      .set({is_public: true})
      .where(eq(textEntries.id, orphan.id));
    expect((await json(await guest.get(`${path}/entries`))).data).toEqual([]);
  });

  it('pages the filtered collection and invalidates cursors when a tag publishes historical rows', async () => {
    const guest = new ApiClient();
    await db()
      .update(textEntries)
      .set({is_public: true})
      .where(eq(textEntries.id, hiddenEntry.id));
    const generation = String(await revision());
    const first = await json(
      await guest.get(
        `${path}/entries?page[after]=${CURSOR_START}&page[size]=1`,
        {[PUBLIC_REVISION_HEADER]: generation}
      )
    );
    expect(first.links.next).toBeTruthy();
    const next = new URL(first.links.next);
    const second = await json(
      await guest.get(`${next.pathname}${next.search}`, {
        [PUBLIC_REVISION_HEADER]: generation,
      })
    );
    expect([...first.data, ...second.data]).toHaveLength(2);
    expect(second.links.next).toBeNull();
    await db()
      .update(tags)
      .set({is_public: true})
      .where(eq(tags.id, hiddenTag.id));
    const refused = await guest.get(`${next.pathname}${next.search}`, {
      [PUBLIC_REVISION_HEADER]: generation,
    });
    expect(refused.status).toBe(409);
    expect((await json(refused)).errors[0].code).toBe(CODES.viewChanged);
    expect(
      (await guest.get(path, {[DATA_OWNER_ID_HEADER]: '999'})).status
    ).toBe(409);
    expect(
      (await guest.get(path, {[DATA_OWNER_ID_HEADER]: String(owner.id)})).status
    ).toBe(200);
  });

  it('never returns a page serialized across a concurrent privacy change', async () => {
    const bindings = raceBeforeStatement(
      /from "tags_tagtextentrythroughmodel"/i,
      () =>
        db()
          .update(textEntries)
          .set({is_public: false})
          .where(eq(textEntries.id, visibleEntry.id))
    );
    const response = await new ApiClient(undefined, bindings).get(
      `${path}/entries?include=text_entry_to_tag`
    );
    expect(response.status).toBe(409);
    expect((await json(response)).errors[0].code).toBe(CODES.viewChanged);
  });

  it('does not count deleted objects or tag links as public', async () => {
    expect(
      (await json(await new ApiClient().get(`${path}/entries`))).data
    ).toHaveLength(1);
    await db()
      .update(tagsEntries)
      .set({is_deleted: true})
      .where(eq(tagsEntries.tag_id, visibleTag.id));
    expect(
      (await json(await new ApiClient().get(`${path}/entries`))).data
    ).toEqual([]);
    await db()
      .update(tags)
      .set({is_deleted: true})
      .where(eq(tags.id, visibleTag.id));
    expect(
      (await json(await new ApiClient().get(`${path}/tags`))).data
    ).toEqual([]);
    await db()
      .update(textEntries)
      .set({is_deleted: true})
      .where(eq(textEntries.id, visibleEntry.id));
    expect(
      (await json(await new ApiClient().get(`${path}/tags_entries`))).data
    ).toEqual([]);
  });

  it('invalidates only the owner changed, including removals and availability', async () => {
    const other = await userFactory({}, {examples: false});
    const untouched = (await refreshUser(other.id))?.public_revision;
    let before = await revision();
    await db().delete(tagsEntries).where(eq(tagsEntries.tag_id, hiddenTag.id));
    expect(await revision()).toBeGreaterThan(before);
    before = await revision();
    await db().delete(tags).where(eq(tags.id, hiddenTag.id));
    expect(await revision()).toBeGreaterThan(before);
    before = await revision();
    await db().delete(textEntries).where(eq(textEntries.id, hiddenEntry.id));
    expect(await revision()).toBeGreaterThan(before);
    await db()
      .update(users)
      .set({is_active: false})
      .where(eq(users.id, owner.id));
    expect((await new ApiClient().get(path)).status).toBe(404);
    await db()
      .update(users)
      .set({is_active: true, date_marked_for_deletion: '2030-01-01'})
      .where(eq(users.id, owner.id));
    expect((await new ApiClient().get(path)).status).toBe(404);
    expect((await refreshUser(other.id))?.public_revision).toBe(untouched);
    expect((await new ApiClient().get('/api/v1/users/nobody')).status).toBe(
      404
    );
  });
});
