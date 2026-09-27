import {and, eq} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/tokens';
import {type TagTextEntry, tags, tagsEntries, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {methodNotAllowed} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {resolveRelated} from './related';
import {reorder} from './reorder';
import {TAG_TEXT_ENTRY} from './serializers';
import {getOwned, isUniqueViolation, resourceResponse} from './viewset';

export const tagEntryOrdering: OrderedSpec = {
  table: tagsEntries,
  id: tagsEntries.id,
  order: tagsEntries.order,
  dateUpdated: tagsEntries.date_updated,
  scope: tagsEntries.tag_id,
};

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
      [junction] = await db
        .insert(tagsEntries)
        .values({
          tag_id: tagId,
          text_entry_id: textEntryId,
          user_id: user.id,
          order: new OrderedModel(db, tagEntryOrdering).nextOrderSql(tagId),
          date_created: timestamp,
          date_updated: timestamp,
        })
        .returning();
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
    [junction] = await db
      .update(tagsEntries)
      .set({user_id: user.id, date_updated: now()})
      .where(eq(tagsEntries.id, junction.id))
      .returning();
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
  await c.get('db').delete(tagsEntries).where(eq(tagsEntries.id, junction.id));
  return c.body(null, 204);
});

tagEntryRoutes.on(['GET', 'PATCH', 'PUT'], ['/', '/:id'], c => {
  throw methodNotAllowed(c.req.method);
});
