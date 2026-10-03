/** Public predicates apply to primary rows, relationship linkage, and includes. */
import {and, eq, getTableColumns, sql} from 'drizzle-orm';
import {tags, tagsEntries, textEntries} from '../db/schema';

export const publicTag = (ownerId: number) =>
  and(
    eq(tags.user_id, ownerId),
    eq(tags.is_public, true),
    eq(tags.is_deleted, false)
  );

export const publicEntry = (ownerId: number) =>
  and(
    eq(textEntries.user_id, ownerId),
    eq(textEntries.is_public, true),
    eq(textEntries.is_deleted, false),
    sql`EXISTS (SELECT 1 FROM tags_tagtextentrythroughmodel j
    JOIN tags_tag t ON t.id = j.tag_id
    WHERE j.text_entry_id = text_entries_textentry.id AND j.user_id = ${ownerId}
    AND t.user_id = ${ownerId} AND j.is_deleted = 0
    AND t.is_deleted = 0 AND t.is_public = 1)`
  );

export const publicJunction = (ownerId: number) =>
  and(
    eq(tagsEntries.user_id, ownerId),
    eq(tagsEntries.is_deleted, false),
    sql`EXISTS (SELECT 1 FROM tags_tag t JOIN text_entries_textentry e
    ON e.id = tags_tagtextentrythroughmodel.text_entry_id
    WHERE t.id = tags_tagtextentrythroughmodel.tag_id AND t.user_id = ${ownerId}
    AND e.user_id = ${ownerId} AND t.is_public = 1 AND t.is_deleted = 0
    AND e.is_public = 1 AND e.is_deleted = 0)`
  );

export const publicEntryCount = (ownerId: number) => sql<number>`(
  SELECT COUNT(*) FROM tags_tagtextentrythroughmodel j
  JOIN text_entries_textentry e ON e.id = j.text_entry_id
  WHERE j.tag_id = tags_tag.id AND j.user_id = ${ownerId} AND e.user_id = ${ownerId}
  AND j.is_deleted = 0 AND e.is_deleted = 0 AND e.is_public = 1)`;

export const publicLastUsed = (ownerId: number) => sql<string | null>`(
  SELECT MAX(j.date_created) FROM tags_tagtextentrythroughmodel j
  JOIN text_entries_textentry e ON e.id = j.text_entry_id
  WHERE j.tag_id = tags_tag.id AND j.user_id = ${ownerId} AND e.user_id = ${ownerId}
  AND j.is_deleted = 0 AND e.is_deleted = 0 AND e.is_public = 1)`;

export const publicTagCount = (ownerId: number) => sql<number>`(
  SELECT COUNT(*) FROM tags_tagtextentrythroughmodel j JOIN tags_tag t ON t.id = j.tag_id
  WHERE j.text_entry_id = text_entries_textentry.id AND j.user_id = ${ownerId}
  AND t.user_id = ${ownerId} AND j.is_deleted = 0 AND t.is_deleted = 0 AND t.is_public = 1)`;

export const publicTagFields = (ownerId: number) => ({
  ...getTableColumns(tags),
  entry_count: publicEntryCount(ownerId),
  date_last_used: publicLastUsed(ownerId),
});
export const publicEntryFields = (ownerId: number) => ({
  ...getTableColumns(textEntries),
  tag_count: publicTagCount(ownerId),
});
