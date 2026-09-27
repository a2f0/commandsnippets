import {eq, sql} from 'drizzle-orm';
import {Hono} from 'hono';
import {requireUser} from '../auth/tokens';
import {entryReuses, type TextEntryReused, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {methodNotAllowed} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {resolveRelated} from './related';
import {TEXT_ENTRY_REUSED} from './serializers';
import {getOwned, listResponse, resourceResponse} from './viewset';

const owned = {
  table: entryReuses,
  id: entryReuses.id,
  userId: entryReuses.user_id,
};

export const entryReuseRoutes = new Hono<AppEnv>();

entryReuseRoutes.get('/', c =>
  listResponse(c, {
    ...owned,
    type: TEXT_ENTRY_REUSED,
    user: requireUser(c),
    filters: {},
    ordering: {date_created: sql`${entryReuses.date_created}`},
    defaultOrdering: [entryReuses.date_created, entryReuses.id],
  })
);

entryReuseRoutes.get('/:id', async c => {
  const reuse = await getOwned<TextEntryReused>(
    c,
    owned,
    c.req.param('id'),
    TEXT_ENTRY_REUSED,
    requireUser(c)
  );
  return resourceResponse(c, TEXT_ENTRY_REUSED, reuse);
});

/** Record a reuse; a trigger maintains the entry's reused_count/date. */
entryReuseRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {relationships} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY_REUSED,
  });
  const ids = await resolveRelated(db, user.id, relationships, [
    {
      name: 'text_entry',
      table: textEntries,
      id: textEntries.id,
      userId: textEntries.user_id,
    },
  ]);
  const [created] = await db
    .insert(entryReuses)
    .values({
      text_entry_id: ids['text_entry'] as number,
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
  const reuse = await getOwned<TextEntryReused>(
    c,
    owned,
    c.req.param('id'),
    TEXT_ENTRY_REUSED,
    requireUser(c)
  );
  await c.get('db').delete(entryReuses).where(eq(entryReuses.id, reuse.id));
  return c.body(null, 204);
});

// Updating a reuse would silently desync the entry's counters.
entryReuseRoutes.on(['PATCH', 'PUT'], '/:id', c => {
  throw methodNotAllowed(c.req.method);
});
