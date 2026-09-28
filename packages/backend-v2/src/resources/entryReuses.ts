import {
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
import {textEntryResource, textEntryReusedResource} from './owned';
import {resolveRelated} from './related';
import {TEXT_ENTRY_REUSED} from './resourceTypes';
import {getOwned, listResponse, resourceResponse} from './viewset';

export const entryReuseRoutes = new Hono<AppEnv>();

entryReuseRoutes.get('/', c =>
  listResponse(c, {
    ...textEntryReusedResource,
    user: requireUser(c),
    query: textEntryReusedListQuerySchema,
    filters: {},
    ordering: {date_created: sql`${entryReuses.date_created}`},
    defaultOrdering: [entryReuses.date_created, entryReuses.id],
  })
);

entryReuseRoutes.get('/:id', async c => {
  const reuse = await getOwned<TextEntryReused>(c, textEntryReusedResource);
  return resourceResponse(c, TEXT_ENTRY_REUSED, reuse);
});

/** Record a reuse; a trigger maintains the entry's reused_count/date. */
entryReuseRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {relationships} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY_REUSED,
  });
  const ids = await resolveRelated(
    db,
    user.id,
    relationships,
    textEntryReusedCreateRelationshipsSchema,
    {text_entry: textEntryResource}
  );
  const [created] = await db
    .insert(entryReuses)
    .values({
      text_entry_id: ids.text_entry,
      user_id: user.id,
      date_created: now(),
    })
    .returning();
  return resourceResponse(
    c,
    TEXT_ENTRY_REUSED,
    created as TextEntryReused,
    201
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
