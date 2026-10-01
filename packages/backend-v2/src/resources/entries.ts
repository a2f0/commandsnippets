import {
  textEntryCreateAttributesSchema,
  textEntryListQuerySchema,
  textEntryUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {and, eq, or, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {isUniqueViolation} from '../db/errors';
import {type TextEntry, textEntries, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {parseResource} from '../lib/jsonapi';
import {fold, searchColumns} from '../lib/search';
import {validateFields} from '../lib/validate';
import {icontains, usernameIs} from './filters';
import {clientUpdated, stamped, writtenBefore} from './lww';
import {nextRevision, textEntryResource} from './owned';
import {TEXT_ENTRY} from './resourceTypes';
import {getOwned, listResponse, resourceResponse, softDelete} from './viewset';

/**
 * Entries tagged with a tag matching `condition`, counting only the
 * requester's own junctions and tags: imported rows can link another user's
 * tag to this user's entry, and matching on it would reveal its name. A
 * deleted junction (untagged) does not count.
 */
const hasTag = (userId: number, condition: ReturnType<typeof sql>) =>
  sql`EXISTS (
    SELECT 1 FROM tags_tagtextentrythroughmodel AS j
    JOIN tags_tag AS t ON t.id = j.tag_id
    WHERE j.text_entry_id = ${textEntries.id}
      AND j.user_id = ${userId}
      AND j.is_deleted = 0
      AND t.user_id = ${userId}
      AND ${condition}
  )`;

export const entryRoutes = new Hono<AppEnv>();

/**
 * `owner`'s entries: the requester's own (`GET /entries`), or for staff
 * another user's, read-only (`GET /admin/users/:id/entries`).
 */
export const listEntries = (c: Context<AppEnv>, owner: User) =>
  listResponse(c, {
    ...textEntryResource,
    user: owner,
    query: textEntryListQuerySchema,
    filters: {
      id: value => eq(textEntries.id, value),
      tags__name: value => hasTag(owner.id, sql`t.name = ${value}`),
      tags__id: value => hasTag(owner.id, sql`t.id = ${value}`),
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

entryRoutes.get('/', c => listEntries(c, requireUser(c)));

entryRoutes.get('/:id', async c => {
  const entry = await getOwned<TextEntry>(c, textEntryResource);
  return resourceResponse(c, TEXT_ENTRY, entry);
});

/**
 * Create an entry. One naming a `client_id` the user's entries already have
 * answers with that entry (201, as a create): a queued create retried after
 * a lost answer is made once.
 */
entryRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: TEXT_ENTRY});
  const {client_id: clientId, ...fields} = validateFields(
    textEntryCreateAttributesSchema,
    attributes
  );
  const when = await clientUpdated(c);
  const made = async () =>
    clientId === undefined
      ? undefined
      : (
          await db
            .select()
            .from(textEntries)
            .where(
              and(
                eq(textEntries.user_id, user.id),
                eq(textEntries.client_id, clientId)
              )
            )
            .limit(1)
        )[0];
  const existing = await made();
  if (existing !== undefined) {
    return resourceResponse(c, TEXT_ENTRY, existing, 201);
  }
  const timestamp = now();
  try {
    const [created] = await db
      .insert(textEntries)
      .values({
        ...fields,
        ...searchColumns(fields),
        user_id: user.id,
        client_id: clientId ?? null,
        client_updated: when.at,
        date_created: timestamp,
        date_updated: nextRevision(textEntryResource, user.id),
      })
      .returning();
    return resourceResponse(c, TEXT_ENTRY, created as TextEntry, 201);
  } catch (error) {
    // Lost a race with the same create, retried.
    const raced = isUniqueViolation(error) ? await made() : undefined;
    if (raced === undefined) {
      throw error;
    }
    return resourceResponse(c, TEXT_ENTRY, raced, 201);
  }
});

entryRoutes.on(['PATCH', 'PUT'], '/:id', async c => {
  const entry = await getOwned<TextEntry>(c, textEntryResource);
  const {attributes} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY,
    id: String(entry.id),
  });
  const changes = validateFields(textEntryUpdateAttributesSchema, attributes);
  const when = await clientUpdated(c);
  // Unless a newer client write stands: then the entry as it is.
  const [updated] = await c
    .get('db')
    .update(textEntries)
    .set({
      ...changes,
      client_updated: stamped(textEntries.client_updated, when),
      // Only the submitted fields' folds: recomputing an untouched field from
      // this request's earlier read could clobber a concurrent edit's fold.
      ...(changes.subject === undefined
        ? {}
        : {subject_folded: fold(changes.subject)}),
      ...(changes.body === undefined ? {} : {body_folded: fold(changes.body)}),
      date_updated: nextRevision(textEntryResource, entry.user_id),
    })
    .where(
      and(
        eq(textEntries.id, entry.id),
        writtenBefore(textEntries.client_updated, when, entry.client_updated)
      )
    )
    .returning();
  return resourceResponse(
    c,
    TEXT_ENTRY,
    updated ?? (await getOwned<TextEntry>(c, textEntryResource))
  );
});

/** Entries are soft-deleted. */
entryRoutes.delete('/:id', c => softDelete(c, textEntryResource));
