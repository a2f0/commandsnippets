import {and, eq, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
import {isUniqueViolation} from '../db/errors';
import {type TagTextEntry, tags, tagsEntries, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {methodNotAllowed} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {revision} from '../lib/revision';
import {resolveRelated} from './related';
import {reorder} from './reorder';
import {TAG_TEXT_ENTRY} from './serializers';
import {getOwned, resourceResponse} from './viewset';

export const tagEntryOrdering: OrderedSpec = {
  table: tagsEntries,
  id: tagsEntries.id,
  order: tagsEntries.order,
  dateUpdated: tagsEntries.date_updated,
  scope: tagsEntries.tag_id,
  // Imported Django data can put another user's junction in a user's tag.
  owner: tagsEntries.user_id,
  // Clients fetch junctions through /entries (included), which is filtered on
  // the entry's revision: advance the entries whose junctions a move re-ranked.
  // The moved junctions carry the owner's newest junction revision; nothing is
  // touched if the move's guarded UPDATE did not apply.
  touch: moved => sql`
    UPDATE ${textEntries}
    SET ${sql.identifier('date_updated')} = ${revision(
      textEntries,
      textEntries.date_updated,
      textEntries.user_id,
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

/**
 * Advance an entry's revision when the junction write batched before it
 * applied (`changes()` counts only that statement's own rows, not triggers').
 * Only the requester's own entries: legacy junctions can link another user's.
 */
const touchEntry = (db: Db, entryId: number, userId: number) =>
  db
    .update(textEntries)
    .set({
      date_updated: revision(
        textEntries,
        textEntries.date_updated,
        textEntries.user_id,
        userId
      ),
    })
    .where(
      and(
        sql`changes() > 0`,
        eq(textEntries.id, entryId),
        eq(textEntries.user_id, userId)
      )
    );

const owned = {
  table: tagsEntries,
  id: tagsEntries.id,
  userId: tagsEntries.user_id,
};

/** Only create, destroy and reorder are routed (Django's viewset mixins). */
export const tagEntryRoutes = new Hono<AppEnv>();

tagEntryRoutes.post('/reorder', c =>
  reorder(c, {
    ...tagEntryOrdering,
    type: TAG_TEXT_ENTRY,
    userId: tagsEntries.user_id,
  })
);

/** Tag an entry: get_or_create on (tag, text_entry). Always 201. */
tagEntryRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {relationships} = await parseResource(c.req.raw, {
    type: TAG_TEXT_ENTRY,
  });
  const ids = await resolveRelated(db, user.id, relationships, [
    {name: 'tag', table: tags, id: tags.id, userId: tags.user_id},
    {
      name: 'text_entry',
      table: textEntries,
      id: textEntries.id,
      userId: textEntries.user_id,
    },
  ]);
  const tagId = ids['tag'] as number;
  const textEntryId = ids['text_entry'] as number;

  const find = async () =>
    (
      await db
        .select()
        .from(tagsEntries)
        .where(
          and(
            eq(tagsEntries.tag_id, tagId),
            eq(tagsEntries.text_entry_id, textEntryId)
          )
        )
        .limit(1)
    )[0];

  let junction = await find();
  if (junction === undefined) {
    const timestamp = now();
    try {
      const [inserted] = await db.batch([
        db
          .insert(tagsEntries)
          .values({
            tag_id: tagId,
            text_entry_id: textEntryId,
            user_id: user.id,
            order: new OrderedModel(db, tagEntryOrdering).nextOrderSql(tagId),
            date_created: timestamp,
            date_updated: revision(
              tagsEntries,
              tagsEntries.date_updated,
              tagsEntries.user_id,
              user.id
            ),
          })
          .returning(),
        touchEntry(db, textEntryId, user.id),
      ]);
      [junction] = inserted;
    } catch (error) {
      if (!isUniqueViolation(error)) {
        throw error;
      }
      junction = await find();
    }
  }
  if (junction !== undefined && junction.user_id !== user.id) {
    // Imported Django data can hold a junction owned by another user between
    // this user's own tag and entry. It links only their data, so it is
    // theirs: take it over rather than return someone else's row.
    const [updated] = await db.batch([
      db
        .update(tagsEntries)
        .set({
          user_id: user.id,
          date_updated: revision(
            tagsEntries,
            tagsEntries.date_updated,
            tagsEntries.user_id,
            user.id
          ),
        })
        .where(eq(tagsEntries.id, junction.id))
        .returning(),
      touchEntry(db, textEntryId, user.id),
    ]);
    [junction] = updated;
  }
  return resourceResponse(c, TAG_TEXT_ENTRY, junction as TagTextEntry, 201);
});

tagEntryRoutes.delete('/:id', async c => {
  const junction = await getOwned<TagTextEntry>(
    c,
    owned,
    c.req.param('id'),
    TAG_TEXT_ENTRY,
    requireUser(c)
  );
  const db = c.get('db');
  await db.batch([
    db.delete(tagsEntries).where(eq(tagsEntries.id, junction.id)),
    touchEntry(db, junction.text_entry_id, junction.user_id),
  ]);
  return c.body(null, 204);
});

tagEntryRoutes.on(['GET', 'PATCH', 'PUT'], ['/', '/:id'], c => {
  throw methodNotAllowed(c.req.method);
});
