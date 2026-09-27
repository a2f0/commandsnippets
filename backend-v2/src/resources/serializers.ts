/**
 * JSON:API resource definitions: the equivalent of the DJA serializers
 * (types, attribute sets, relationships and default `included_resources`).
 */
import {asc} from 'drizzle-orm';
import {type Db, inIds} from '../db/client';
import {
  entryReuses,
  type Tag,
  type TagTextEntry,
  type TextEntry,
  type TextEntryReused,
  tags,
  tagsEntries,
  textEntries,
  type User,
  users,
} from '../db/schema';
import {isoformat} from '../lib/clock';
import type {Registry, ResourceDef} from '../lib/jsonapi';

export const USER = 'User';
export const TAG = 'Tag';
export const TEXT_ENTRY = 'TextEntry';
export const TAG_TEXT_ENTRY = 'TagTextEntryThroughModel';
export const TEXT_ENTRY_REUSED = 'TextEntryReused';

export function createRegistry(db: Db): Registry {
  const user: ResourceDef<User> = {
    type: USER,
    load: ids => db.select().from(users).where(inIds(users.id, ids)),
    attributes: row => ({
      username: row.username,
      date_updated: isoformat(row.date_updated),
    }),
    relationships: {},
    defaultIncludes: [],
  };

  const tag: ResourceDef<Tag> = {
    type: TAG,
    load: ids => db.select().from(tags).where(inIds(tags.id, ids)),
    attributes: row => ({
      name: row.name,
      date_created: isoformat(row.date_created),
      date_last_used: isoformat(row.date_last_used),
      date_updated: isoformat(row.date_updated),
      entry_count: row.entry_count,
      order: row.order,
      is_deleted: row.is_deleted,
    }),
    relationships: {user: {type: USER, key: row => row.user_id}},
    defaultIncludes: ['user'],
  };

  const textEntry: ResourceDef<TextEntry> = {
    type: TEXT_ENTRY,
    load: ids =>
      db.select().from(textEntries).where(inIds(textEntries.id, ids)),
    attributes: row => ({
      body: row.body,
      subject: row.subject,
      date_updated: isoformat(row.date_updated),
      date_created: isoformat(row.date_created),
      reused_count: row.reused_count,
      is_deleted: row.is_deleted,
      tag_count: row.tag_count,
    }),
    relationships: {
      user: {type: USER, key: row => row.user_id},
      text_entry_to_tag: {
        type: TAG_TEXT_ENTRY,
        many: true,
        load: parentIds =>
          db
            .select()
            .from(tagsEntries)
            .where(inIds(tagsEntries.text_entry_id, parentIds))
            .orderBy(asc(tagsEntries.date_updated), asc(tagsEntries.id)),
        parentKey: (row: TagTextEntry) => row.text_entry_id,
      },
    },
    defaultIncludes: ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user'],
  };

  const tagTextEntry: ResourceDef<TagTextEntry> = {
    type: TAG_TEXT_ENTRY,
    load: ids =>
      db.select().from(tagsEntries).where(inIds(tagsEntries.id, ids)),
    attributes: row => ({
      order: row.order,
      date_updated: isoformat(row.date_updated),
      date_created: isoformat(row.date_created),
    }),
    relationships: {
      tag: {type: TAG, key: row => row.tag_id},
      text_entry: {type: TEXT_ENTRY, key: row => row.text_entry_id},
      user: {type: USER, key: row => row.user_id},
    },
    defaultIncludes: ['user', 'tag', 'text_entry'],
  };

  const textEntryReused: ResourceDef<TextEntryReused> = {
    type: TEXT_ENTRY_REUSED,
    load: ids =>
      db.select().from(entryReuses).where(inIds(entryReuses.id, ids)),
    attributes: () => ({}),
    relationships: {
      text_entry: {type: TEXT_ENTRY, key: row => row.text_entry_id},
      user: {type: USER, key: row => row.user_id},
    },
    defaultIncludes: [],
  };

  return {
    [USER]: user,
    [TAG]: tag,
    [TEXT_ENTRY]: textEntry,
    [TAG_TEXT_ENTRY]: tagTextEntry,
    [TEXT_ENTRY_REUSED]: textEntryReused,
  } as unknown as Registry;
}
