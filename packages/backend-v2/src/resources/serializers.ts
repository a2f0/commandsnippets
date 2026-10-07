/**
 * JSON:API resource definitions: the equivalent of the DJA serializers
 * (types, attribute sets, relationships and default `included_resources`).
 * Relationships and default includes are api-shared's (`RELATIONSHIPS`,
 * `DEFAULT_INCLUDES`); the attributes are what its resource schemas describe.
 */
import {
  DEFAULT_INCLUDES,
  type RELATIONSHIPS,
} from '@commandsnippets/api-shared';
import {and, asc, eq, getTableColumns} from 'drizzle-orm';
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
import type {Registry, ResourceDef, ToMany, ToOne} from '../lib/jsonapi';
import {
  publicEntry,
  publicEntryFields,
  publicJunction,
  publicTag,
  publicTagFields,
} from './publicPolicy';
import {
  TAG,
  TAG_TEXT_ENTRY,
  TEXT_ENTRY,
  TEXT_ENTRY_REUSED,
  USER,
} from './resourceTypes';

type Relationships = typeof RELATIONSHIPS;

/**
 * A resource's relationships as api-shared names them: the same names, each
 * pointing at the same type, to-many exactly where the contract says so.
 */
type RelationshipsOf<T extends keyof Relationships, Row> = {
  [K in keyof Relationships[T]]: Relationships[T][K] extends {
    type: infer Related;
    many: true;
  }
    ? ToMany & {type: Related}
    : Relationships[T][K] extends {type: infer Related}
      ? ToOne<Row> & {type: Related}
      : never;
};

/**
 * Every loader is scoped to `userId`, the requesting user: reads are
 * owner-only, and a relationship must not become a way around that. Django
 * never checked ownership when recording reuses or tags, so imported rows can
 * point at another user's entry or tag; such a resource keeps its relationship
 * linkage (an id) but is never loaded into `included`.
 */
export function createRegistry(
  db: Db,
  userId: number,
  publicOnly = false
): Registry {
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
      is_staff: publicOnly ? false : row.is_staff,
      date_updated: isoformat(row.date_updated),
      date_restored: publicOnly ? null : row.date_restored,
    }),
    relationships: {} satisfies RelationshipsOf<typeof USER, User>,
    defaultIncludes: DEFAULT_INCLUDES[USER],
  };

  const tag: ResourceDef<Tag> = {
    type: TAG,
    load: ids =>
      db
        .select(publicOnly ? publicTagFields(userId) : getTableColumns(tags))
        .from(tags)
        .where(
          and(
            inIds(tags.id, ids),
            eq(tags.user_id, userId),
            publicOnly ? publicTag(userId) : undefined
          )
        ),
    attributes: row => ({
      name: row.name,
      date_created: isoformat(row.date_created),
      date_last_used: isoformat(row.date_last_used),
      date_updated: isoformat(row.date_updated),
      entry_count: row.entry_count,
      order: row.order,
      is_deleted: row.is_deleted,
      is_public: row.is_public,
      client_id: publicOnly ? null : row.client_id,
    }),
    relationships: {
      user: {type: USER, key: row => row.user_id},
    } satisfies RelationshipsOf<typeof TAG, Tag>,
    defaultIncludes: DEFAULT_INCLUDES[TAG],
  };

  const textEntry: ResourceDef<TextEntry> = {
    type: TEXT_ENTRY,
    load: ids =>
      db
        .select(
          publicOnly ? publicEntryFields(userId) : getTableColumns(textEntries)
        )
        .from(textEntries)
        .where(
          and(
            inIds(textEntries.id, ids),
            eq(textEntries.user_id, userId),
            publicOnly ? publicEntry(userId) : undefined
          )
        ),
    attributes: row => ({
      body: row.body,
      subject: row.subject,
      date_updated: isoformat(row.date_updated),
      date_created: isoformat(row.date_created),
      reused_count: publicOnly ? 0 : row.reused_count,
      is_deleted: row.is_deleted,
      is_public: row.is_public,
      tag_count: row.tag_count,
      client_id: publicOnly ? null : row.client_id,
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
                eq(tagsEntries.user_id, userId),
                // The entry's tags: a deleted junction is only in the
                // junction list, which shows its tag's syncs it left.
                eq(tagsEntries.is_deleted, false),
                publicOnly ? publicJunction(userId) : undefined
              )
            )
            .orderBy(asc(tagsEntries.date_updated), asc(tagsEntries.id)),
        parentKey: (row: TagTextEntry) => row.text_entry_id,
      },
    } satisfies RelationshipsOf<typeof TEXT_ENTRY, TextEntry>,
    defaultIncludes: DEFAULT_INCLUDES[TEXT_ENTRY],
  };

  const tagTextEntry: ResourceDef<TagTextEntry> = {
    type: TAG_TEXT_ENTRY,
    load: ids =>
      db
        .select()
        .from(tagsEntries)
        .where(
          and(
            inIds(tagsEntries.id, ids),
            eq(tagsEntries.user_id, userId),
            publicOnly ? publicJunction(userId) : undefined
          )
        ),
    attributes: row => ({
      order: row.order,
      date_updated: isoformat(row.date_updated),
      date_created: isoformat(row.date_created),
      is_deleted: row.is_deleted,
    }),
    relationships: {
      tag: {type: TAG, key: row => row.tag_id},
      text_entry: {type: TEXT_ENTRY, key: row => row.text_entry_id},
      user: {type: USER, key: row => row.user_id},
    } satisfies RelationshipsOf<typeof TAG_TEXT_ENTRY, TagTextEntry>,
    defaultIncludes: DEFAULT_INCLUDES[TAG_TEXT_ENTRY],
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
    } satisfies RelationshipsOf<typeof TEXT_ENTRY_REUSED, TextEntryReused>,
    defaultIncludes: DEFAULT_INCLUDES[TEXT_ENTRY_REUSED],
  };

  return {
    [USER]: user,
    [TAG]: tag,
    [TEXT_ENTRY]: textEntry,
    [TAG_TEXT_ENTRY]: tagTextEntry,
    [TEXT_ENTRY_REUSED]: textEntryReused,
  } as unknown as Registry;
}
