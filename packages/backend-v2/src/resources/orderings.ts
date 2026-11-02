/** How tags and their junctions are ranked (lib/ordered.ts's specs). */
import {sql} from 'drizzle-orm';
import {tags, tagsEntries, textEntries} from '../db/schema';
import type {OrderedSpec} from '../lib/ordered';
import {nextRevision, textEntryResource} from './owned';

export const tagOrdering: OrderedSpec = {
  table: tags,
  id: tags.id,
  order: tags.order,
  dateUpdated: tags.date_updated,
  scope: tags.user_id,
};

export const tagEntryOrdering: OrderedSpec = {
  table: tagsEntries,
  id: tagsEntries.id,
  order: tagsEntries.order,
  dateUpdated: tagsEntries.date_updated,
  scope: tagsEntries.tag_id,
  // The tag's user (a junction is its tag's: migrations/0021_own_links.sql),
  // whose revisions a move takes.
  owner: tagsEntries.user_id,
  // A deleted junction is out of its tag's order (it keeps its old rank).
  ranked: sql`${tagsEntries.is_deleted} = 0`,
  // Clients sync junctions as /entries includes, filtered on the entry's
  // revision: advance the entries whose junctions a move re-ranked (their
  // trigger advances the tag, migrations/0008_tag_revisions.sql, and the
  // entry's junctions, 0010_junction_revisions.sql). The tag's junction list
  // sees the move itself: the shifted junctions carry its revision.
  // The moved junctions carry the owner's newest junction revision; nothing is
  // touched if the move's guarded UPDATE did not apply.
  touch: moved => sql`
    UPDATE ${textEntries}
    SET ${sql.identifier('date_updated')} = ${nextRevision(
      textEntryResource,
      moved.owner as number
    )}
    WHERE changes() > 0
      AND ${textEntries.user_id} = ${moved.owner}
      AND ${textEntries.id} IN (
        SELECT j.text_entry_id FROM ${tagsEntries} AS j
        WHERE j.tag_id = ${moved.scope}
          AND j.user_id = ${moved.owner}
          AND j.date_updated = (
            SELECT MAX(date_updated) FROM ${tagsEntries}
            WHERE user_id = ${moved.owner}
          )
      )
  `,
};
