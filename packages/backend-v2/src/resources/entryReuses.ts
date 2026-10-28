import {
  textEntryReusedCreateAttributesSchema,
  textEntryReusedCreateRelationshipsSchema,
  textEntryReusedListQuerySchema,
} from '@commandsnippets/api-shared';
import {eq, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/permissions';
import {entryReuses, type TextEntryReused} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {methodNotAllowed} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {validateFields} from '../lib/validate';
import {versionOf} from './dataVersions';
import {textEntryResource, textEntryReusedResource} from './owned';
import {resolveRelated} from './related';
import {TEXT_ENTRY_REUSED} from './resourceTypes';
import {createOnce, getOwned, listResponse, resourceResponse} from './viewset';

export const entryReuseRoutes = new Hono<AppEnv>();

entryReuseRoutes.get('/', c =>
  listResponse(c, {
    ...textEntryReusedResource,
    user: requireUser(c),
    query: textEntryReusedListQuerySchema,
    filters: {
      text_entry__id: value => eq(entryReuses.text_entry_id, value),
    },
    ordering: {date_created: sql`${entryReuses.date_created}`},
    defaultOrdering: [entryReuses.date_created, entryReuses.id],
  })
);

entryReuseRoutes.get('/:id', async c => {
  const reuse = await getOwned<TextEntryReused>(c, textEntryReusedResource);
  return resourceResponse(c, TEXT_ENTRY_REUSED, reuse);
});

/**
 * Record a reuse (201); a trigger maintains the entry's reused_count. One
 * naming a `client_id` the user's reuses already have answers with that
 * reuse, as its first attempt was answered (201): a queued reuse retried
 * after a lost answer is counted once.
 */
entryReuseRoutes.post('/', async c => {
  const user = requireUser(c);
  const version = versionOf(c, user);
  const db = c.get('db');
  const {attributes, relationships} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY_REUSED,
  });
  const {client_id: clientId} = validateFields(
    textEntryReusedCreateAttributesSchema,
    attributes
  );
  const ids = await resolveRelated(
    db,
    user.id,
    version,
    relationships,
    textEntryReusedCreateRelationshipsSchema,
    {text_entry: textEntryResource}
  );
  return createOnce(
    c,
    {...textEntryReusedResource, clientId: entryReuses.client_id},
    {userId: user.id, version, clientId},
    () =>
      db
        .insert(entryReuses)
        .values({
          text_entry_id: ids.text_entry,
          user_id: user.id,
          version,
          client_id: clientId ?? null,
          date_created: now(),
        })
        .returning()
  );
});

entryReuseRoutes.delete('/:id', async c => {
  const reuse = await getOwned<TextEntryReused>(c, textEntryReusedResource);
  await c.get('db').delete(entryReuses).where(eq(entryReuses.id, reuse.id));
  return c.body(null, 204);
});

// Updating a reuse would silently desync the entry's counters.
entryReuseRoutes.on(['PATCH', 'PUT'], '/:id', c => {
  throw methodNotAllowed(c.req.method);
});
