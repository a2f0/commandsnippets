import {
  textEntryCreateAttributesSchema,
  textEntryListQuerySchema,
  textEntryUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {eq, or, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {type TextEntry, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {parseResource} from '../lib/jsonapi';
import {fold, searchColumns} from '../lib/search';
import {validateFields} from '../lib/validate';
import {icontains, usernameIs} from './filters';
import {nextRevision, textEntryResource} from './owned';
import {TEXT_ENTRY} from './resourceTypes';
import {getOwned, listResponse, resourceResponse, softDelete} from './viewset';

/**
 * Entries tagged with a tag matching `condition`, counting only the
 * requester's own junctions and tags: imported rows can link another user's
 * tag to this user's entry, and matching on it would reveal its name.
 */
const hasTag = (userId: number, condition: ReturnType<typeof sql>) =>
  sql`EXISTS (
    SELECT 1 FROM tags_tagtextentrythroughmodel AS j
    JOIN tags_tag AS t ON t.id = j.tag_id
    WHERE j.text_entry_id = ${textEntries.id}
      AND j.user_id = ${userId}
      AND t.user_id = ${userId}
      AND ${condition}
  )`;

export const entryRoutes = new Hono<AppEnv>();

entryRoutes.get('/', c => {
  const user = requireUser(c);
  return listResponse(c, {
    ...textEntryResource,
    user,
    query: textEntryListQuerySchema,
    filters: {
      id: value => eq(textEntries.id, value),
      tags__name: value => hasTag(user.id, sql`t.name = ${value}`),
      tags__id: value => hasTag(user.id, sql`t.id = ${value}`),
      user__username: value => usernameIs(textEntries.user_id, value),
      tag_count: value => eq(textEntries.tag_count, value),
      is_deleted: value => eq(textEntries.is_deleted, value),
      date_updated__gt: value => sql`${textEntries.date_updated} > ${value}`,
    },
    ordering: {
      body: sql`${textEntries.body} COLLATE NOCASE`,
      date_created: sql`${textEntries.date_created}`,
      date_updated: sql`${textEntries.date_updated}`,
      subject: sql`${textEntries.subject} COLLATE NOCASE`,
    },
    defaultOrdering: [textEntries.date_updated, textEntries.id],
    // Django's icontains on body OR subject, over the folded copies so
    // non-ASCII text matches case-insensitively too.
    search: term =>
      or(
        icontains(textEntries.body_folded, fold(term)),
        icontains(textEntries.subject_folded, fold(term))
      ) as ReturnType<typeof sql>,
  });
});

entryRoutes.get('/:id', async c => {
  const entry = await getOwned<TextEntry>(c, textEntryResource);
  return resourceResponse(c, TEXT_ENTRY, entry);
});

entryRoutes.post('/', async c => {
  const user = requireUser(c);
  const {attributes} = await parseResource(c.req.raw, {type: TEXT_ENTRY});
  const fields = validateFields(textEntryCreateAttributesSchema, attributes);
  const timestamp = now();
  const [created] = await c
    .get('db')
    .insert(textEntries)
    .values({
      ...fields,
      ...searchColumns(fields),
      user_id: user.id,
      date_created: timestamp,
      date_updated: nextRevision(textEntryResource, user.id),
    })
    .returning();
  return resourceResponse(c, TEXT_ENTRY, created as TextEntry, 201);
});

entryRoutes.on(['PATCH', 'PUT'], '/:id', async c => {
  const entry = await getOwned<TextEntry>(c, textEntryResource);
  const {attributes} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY,
    id: String(entry.id),
  });
  const changes = validateFields(textEntryUpdateAttributesSchema, attributes);
  const [updated] = await c
    .get('db')
    .update(textEntries)
    .set({
      ...changes,
      // Only the submitted fields' folds: recomputing an untouched field from
      // this request's earlier read could clobber a concurrent edit's fold.
      ...(changes.subject === undefined
        ? {}
        : {subject_folded: fold(changes.subject)}),
      ...(changes.body === undefined ? {} : {body_folded: fold(changes.body)}),
      date_updated: nextRevision(textEntryResource, entry.user_id),
    })
    .where(eq(textEntries.id, entry.id))
    .returning();
  return resourceResponse(c, TEXT_ENTRY, updated as TextEntry);
});

/** Entries are soft-deleted. */
entryRoutes.delete('/:id', c => softDelete(c, textEntryResource));
