import {
  textEntryCreateAttributesSchema,
  textEntryListQuerySchema,
  textEntryUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {eq, or, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {type TextEntry, textEntries, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {parseResource} from '../lib/jsonapi';
import {fold, searchColumns} from '../lib/search';
import {validateFields} from '../lib/validate';
import {versionOf} from './dataVersions';
import {icontains} from './filters';
import {clientUpdated} from './lww';
import {entryColumns, nextRevision, textEntryResource} from './owned';
import {publicEntry, publicEntryFields, publicTagCount} from './publicPolicy';
import {TEXT_ENTRY} from './resourceTypes';
import {
  createOnce,
  getOwned,
  listResponse,
  resourceResponse,
  softDelete,
  writeOwned,
} from './viewset';

/**
 * Entries tagged with a tag matching `condition`, through the requester's own
 * junctions (each joins the user's own tag: migrations/0021_own_links.sql). A
 * deleted junction (untagged) does not count. Not correlated with the entry,
 * so SQLite reads the matching junctions once rather than probing them for
 * each of the user's entries.
 */
const hasTag = (
  userId: number,
  condition: ReturnType<typeof sql>,
  publicOnly = false
) =>
  sql`${textEntries.id} IN (
    SELECT j.text_entry_id FROM tags_tagtextentrythroughmodel AS j
    JOIN tags_tag AS t ON t.id = j.tag_id
    WHERE j.user_id = ${userId}
      AND j.is_deleted = 0
      AND ${publicOnly ? sql`t.is_public = 1 AND t.is_deleted = 0` : sql`1`}
      AND ${condition}
  )`;

export const entryRoutes = new Hono<AppEnv>();

/**
 * `owner`'s entries: the requester's own (`GET /entries`), or for staff
 * another user's, read-only (`GET /admin/users/:id/entries`).
 */
export const listEntries = (
  c: Context<AppEnv>,
  owner: User,
  publicOnly = false
) =>
  listResponse(c, {
    ...textEntryResource,
    user: owner,
    publicOnly,
    ...(publicOnly
      ? {visibility: publicEntry(owner.id), fields: publicEntryFields(owner.id)}
      : {fields: entryColumns}),
    query: textEntryListQuerySchema,
    filters: {
      id: value => eq(textEntries.id, value),
      tags__name: value => hasTag(owner.id, sql`t.name = ${value}`, publicOnly),
      tags__id: value => hasTag(owner.id, sql`t.id = ${value}`, publicOnly),
      tag_count: value =>
        publicOnly
          ? eq(publicTagCount(owner.id), value)
          : eq(textEntries.tag_count, value),
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
 * Create an entry (201). One naming a `client_id` the user's entries already
 * have answers with that entry, as its first attempt was answered (201): a
 * queued create retried after a lost answer is made once.
 */
entryRoutes.post('/', async c => {
  const user = requireUser(c);
  const version = versionOf(c, user);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: TEXT_ENTRY});
  const {client_id: clientId, ...fields} = validateFields(
    textEntryCreateAttributesSchema,
    attributes
  );
  const at = await clientUpdated(c);
  return createOnce(
    c,
    {...textEntryResource, clientId: textEntries.client_id},
    {userId: user.id, version, clientId},
    () =>
      db
        .insert(textEntries)
        .values({
          ...fields,
          ...searchColumns(fields),
          user_id: user.id,
          version,
          client_id: clientId ?? null,
          client_updated: at,
          date_created: now(),
          date_updated: nextRevision(textEntryResource, user.id),
        })
        .returning()
  );
});

entryRoutes.on(['PATCH', 'PUT'], '/:id', async c => {
  const entry = await getOwned<TextEntry>(c, textEntryResource);
  const {attributes} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY,
    id: String(entry.id),
  });
  const changes = validateFields(textEntryUpdateAttributesSchema, attributes);
  return writeOwned(c, textEntryResource, entry, {
    ...changes,
    // Only the submitted fields' folds: recomputing an untouched field from
    // this request's earlier read could clobber a concurrent edit's fold.
    ...(changes.subject === undefined
      ? {}
      : {subject_folded: fold(changes.subject)}),
    ...(changes.body === undefined ? {} : {body_folded: fold(changes.body)}),
  });
});

/** Entries are soft-deleted. */
entryRoutes.delete('/:id', c => softDelete(c, textEntryResource));
