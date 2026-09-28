/**
 * JSON:API resource definitions: the equivalent of the DJA serializers
 * (types, attribute sets, relationships and default `included_resources`).
 */
import {and, asc, eq} from 'drizzle-orm';
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

/**
 * Every loader is scoped to `userId`, the requesting user: reads are
 * owner-only, and a relationship must not become a way around that. Django
 * never checked ownership when recording reuses or tags, so imported rows can
 * point at another user's entry or tag; such a resource keeps its relationship
 * linkage (an id) but is never loaded into `included`.
 */
export function createRegistry(db: Db, userId: number): Registry {
  const user: ResourceDef<User> = {
    type: USER,
    load: ids =>
      db
        .select()
        .from(users)
        .where(and(inIds(users.id, ids), eq(users.id, userId))),
    // Only ever the requester's own row (see `load`), so is_staff tells the
    // web app whether to offer the admin page; the admin API checks it again.
    attributes: row => ({
      username: row.username,
      is_staff: row.is_staff,
      date_updated: isoformat(row.date_updated),
    }),
    relationships: {},
    defaultIncludes: [],
  };

  const tag: ResourceDef<Tag> = {
    type: TAG,
    load: ids =>
      db
        .select()
        .from(tags)
        .where(and(inIds(tags.id, ids), eq(tags.user_id, userId))),
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
      db
        .select()
        .from(textEntries)
        .where(
          and(inIds(textEntries.id, ids), eq(textEntries.user_id, userId))
        ),
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
            .where(
              and(
                inIds(tagsEntries.text_entry_id, parentIds),
                eq(tagsEntries.user_id, userId)
              )
            )
            .orderBy(asc(tagsEntries.date_updated), asc(tagsEntries.id)),
        parentKey: (row: TagTextEntry) => row.text_entry_id,
      },
    },
    defaultIncludes: ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user'],
  };

  const tagTextEntry: ResourceDef<TagTextEntry> = {
    type: TAG_TEXT_ENTRY,
    load: ids =>
      db
        .select()
        .from(tagsEntries)
        .where(
          and(inIds(tagsEntries.id, ids), eq(tagsEntries.user_id, userId))
        ),
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
      db
        .select()
        .from(entryReuses)
        .where(
          and(inIds(entryReuses.id, ids), eq(entryReuses.user_id, userId))
        ),
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
