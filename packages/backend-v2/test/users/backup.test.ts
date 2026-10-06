import {backupSchema} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {beforeEach, describe, expect, it} from 'vitest';
import {tags, tagsEntries, textEntries} from '../../src/db/schema';
import {
  ApiClient,
  type Base,
  db,
  entriesOf,
  isoformat,
  json,
  setUpBase,
  tagFactory,
  tagsOf,
  tagTextEntryFactory,
  textEntryFactory,
  textEntryReusedFactory,
  tokenFor,
  userFactory,
} from '../helpers';

// v2: a backup of the requester's own data.
describe('GET /api/v1/user/backup', () => {
  let base: Base;

  beforeEach(async () => {
    base = await setUpBase();
  });

  const backupOf = async (client: ApiClient) => {
    const response = await client.get('/api/v1/user/backup');
    expect(response.status).toBe(200);
    return backupSchema.parse(await json(response));
  };

  it('holds every tag, entry, tagging and reuse, with their ids', async () => {
    const [entry] = await entriesOf(base.user1);
    if (entry === undefined) throw new Error('no example entry');
    const reuse = await textEntryReusedFactory({
      text_entry: entry,
      user: base.user1,
    });
    const userTags = await tagsOf(base.user1);
    const userEntries = await entriesOf(base.user1);
    const taggings = await db()
      .select()
      .from(tagsEntries)
      .where(eq(tagsEntries.user_id, base.user1.id));

    const backup = await backupOf(base.user1Client);

    expect(backup.format).toBe('commandsnippets-backup');
    expect(backup.version).toBe(1);
    expect(backup.user).toEqual({
      id: String(base.user1.id),
      username: base.user1.username,
    });
    expect(backup.tags).toEqual(
      [...userTags]
        .sort((a, b) => a.order - b.order)
        .map(tag => ({
          id: String(tag.id),
          name: tag.name,
          order: tag.order,
          is_public: tag.is_public,
          date_created: isoformat(tag.date_created),
          date_updated: isoformat(tag.date_updated),
        }))
    );
    expect(backup.entries).toEqual(
      [...userEntries]
        .sort((a, b) => a.id - b.id)
        .map(row => ({
          id: String(row.id),
          subject: row.subject,
          body: row.body,
          is_public: row.is_public,
          date_created: isoformat(row.date_created),
          date_updated: isoformat(row.date_updated),
        }))
    );
    expect(backup.tags_entries).toEqual(
      [...taggings]
        .sort((a, b) => a.tag_id - b.tag_id || a.order - b.order)
        .map(row => ({
          id: String(row.id),
          tag_id: String(row.tag_id),
          text_entry_id: String(row.text_entry_id),
          order: row.order,
          date_created: isoformat(row.date_created),
          date_updated: isoformat(row.date_updated),
        }))
    );
    expect(backup.tags_entries).toHaveLength(3);
    expect(backup.entry_reuses).toEqual([
      {
        id: String(reuse.id),
        text_entry_id: String(entry.id),
        date_created: isoformat(reuse.date_created),
      },
    ]);
  });

  it("holds none of another user's data", async () => {
    const backup = await backupOf(base.user1Client);
    const ids = (rows: {id: string}[]) => rows.map(row => Number(row.id));
    const otherTags = await tagsOf(base.user2);
    const otherEntries = await entriesOf(base.user2);
    for (const tag of otherTags) {
      expect(ids(backup.tags)).not.toContain(tag.id);
    }
    for (const entry of otherEntries) {
      expect(ids(backup.entries)).not.toContain(entry.id);
    }
    const user2Backup = await backupOf(
      new ApiClient(await tokenFor(base.user2.id))
    );
    expect(ids(user2Backup.tags).sort()).toEqual(
      otherTags.map(tag => tag.id).sort()
    );
    expect(user2Backup.user.username).toBe(base.user2.username);
  });

  it('leaves out deleted rows, and the taggings and reuses of them', async () => {
    const user = await userFactory({}, {examples: false});
    const client = new ApiClient(await tokenFor(user.id));
    const kept = await tagFactory({user, name: 'kept'});
    const deletedTag = await tagFactory({user, name: 'gone'});
    const entry = await textEntryFactory({user});
    const deletedEntry = await textEntryFactory({user});
    const tagging = await tagTextEntryFactory({
      tag: kept,
      text_entry: entry,
      user,
    });
    await tagTextEntryFactory({tag: deletedTag, text_entry: entry, user});
    await tagTextEntryFactory({tag: kept, text_entry: deletedEntry, user});
    const untagged = await textEntryFactory({user});
    await tagTextEntryFactory({
      tag: kept,
      text_entry: untagged,
      user,
      is_deleted: true,
    });
    const reuse = await textEntryReusedFactory({text_entry: entry, user});
    await textEntryReusedFactory({text_entry: deletedEntry, user});
    await db()
      .update(tags)
      .set({is_deleted: true})
      .where(eq(tags.id, deletedTag.id));
    await db()
      .update(textEntries)
      .set({is_deleted: true})
      .where(eq(textEntries.id, deletedEntry.id));

    const backup = await backupOf(client);

    expect(backup.tags.map(tag => tag.id)).toEqual([String(kept.id)]);
    expect(backup.entries.map(row => row.id)).toEqual([
      String(entry.id),
      String(untagged.id),
    ]);
    expect(backup.tags_entries.map(row => row.id)).toEqual([
      String(tagging.id),
    ]);
    expect(backup.entry_reuses.map(row => row.id)).toEqual([String(reuse.id)]);
  });

  it("leaves out a tagging of another user's tag or entry", async () => {
    // Django never checked ownership, so imported rows can do this.
    const user = await userFactory({}, {examples: false});
    const client = new ApiClient(await tokenFor(user.id));
    const tag = await tagFactory({user});
    const entry = await textEntryFactory({user});
    const theirTag = await tagFactory({user: base.user2});
    const theirEntry = await textEntryFactory({user: base.user2});
    await tagTextEntryFactory({tag: theirTag, text_entry: entry, user});
    await tagTextEntryFactory({tag, text_entry: theirEntry, user});
    await textEntryReusedFactory({text_entry: theirEntry, user});

    const backup = await backupOf(client);

    expect(backup.tags.map(row => row.id)).toEqual([String(tag.id)]);
    expect(backup.entries.map(row => row.id)).toEqual([String(entry.id)]);
    expect(backup.tags_entries).toEqual([]);
    expect(backup.entry_reuses).toEqual([]);
  });

  it('is an empty backup for a user with no data', async () => {
    const user = await userFactory({}, {examples: false});
    const backup = await backupOf(new ApiClient(await tokenFor(user.id)));
    expect(backup).toMatchObject({
      tags: [],
      entries: [],
      tags_entries: [],
      entry_reuses: [],
    });
  });

  it('is JSON that no cache keeps', async () => {
    const response = await base.user1Client.get('/api/v1/user/backup');
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it('is refused without a session', async () => {
    const response = await base.unauthenticatedClient.get(
      '/api/v1/user/backup'
    );
    expect(response.status).toBe(403);
    expect((await json(response)).errors[0].code).toBe('not_authenticated');
  });
});
