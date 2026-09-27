import {eq, or, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/tokens';
import {type TextEntry, textEntries} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {parseResource} from '../lib/jsonapi';
import {booleanField, charField, validateOrThrow} from '../lib/validation';
import {boolean, dateTime, icontains, integer, usernameIs} from './filters';
import {TEXT_ENTRY} from './serializers';
import {getOwned, listResponse, resourceResponse} from './viewset';

const SUBJECT_MAX_LENGTH = 255;
const BODY_MAX_LENGTH = 1024;

const owned = {
  table: textEntries,
  id: textEntries.id,
  userId: textEntries.user_id,
};

const hasTag = (condition: ReturnType<typeof sql>) =>
  sql`EXISTS (
    SELECT 1 FROM tags_tagtextentrythroughmodel AS j
    JOIN tags_tag AS t ON t.id = j.tag_id
    WHERE j.text_entry_id = ${textEntries.id} AND ${condition}
  )`;

export const entryRoutes = new Hono<AppEnv>();

entryRoutes.get('/', c =>
  listResponse(c, {
    ...owned,
    type: TEXT_ENTRY,
    user: requireUser(c),
    filters: {
      id: value => eq(textEntries.id, integer(value)),
      tags__name: value => hasTag(sql`t.name = ${value}`),
      tags__id: value => hasTag(sql`t.id = ${integer(value)}`),
      user__username: value => usernameIs(textEntries.user_id, value),
      tag_count: value => eq(textEntries.tag_count, integer(value)),
      is_deleted: value => eq(textEntries.is_deleted, boolean(value)),
      date_updated__gt: value =>
        sql`${textEntries.date_updated} > ${dateTime(value)}`,
    },
    ordering: {
      body: sql`${textEntries.body} COLLATE NOCASE`,
      date_created: sql`${textEntries.date_created}`,
      date_updated: sql`${textEntries.date_updated}`,
      subject: sql`${textEntries.subject} COLLATE NOCASE`,
    },
    defaultOrdering: [textEntries.date_updated, textEntries.id],
    search: term =>
      or(
        icontains(textEntries.body, term),
        icontains(textEntries.subject, term)
      ) as ReturnType<typeof sql>,
  })
);

entryRoutes.get('/:id', async c => {
  const entry = await getOwned<TextEntry>(
    c,
    owned,
    c.req.param('id'),
    TEXT_ENTRY,
    requireUser(c)
  );
  return resourceResponse(c, TEXT_ENTRY, entry);
});

entryRoutes.post('/', async c => {
  const user = requireUser(c);
  const {attributes} = await parseResource(c.req.raw, {type: TEXT_ENTRY});
  const fields = validateOrThrow<{body: string; subject: string}>(
    {
      body: charField({maxLength: BODY_MAX_LENGTH}),
      subject: charField({maxLength: SUBJECT_MAX_LENGTH}),
    },
    attributes
  );
  const timestamp = now();
  const [created] = await c
    .get('db')
    .insert(textEntries)
    .values({
      ...fields,
      user_id: user.id,
      date_created: timestamp,
      date_updated: timestamp,
    })
    .returning();
  return resourceResponse(c, TEXT_ENTRY, created as TextEntry, 201);
});

const update = async (c: Context<AppEnv>) => {
  const entry = await getOwned<TextEntry>(
    c,
    owned,
    c.req.param('id'),
    TEXT_ENTRY,
    requireUser(c)
  );
  const {attributes} = await parseResource(c.req.raw, {
    type: TEXT_ENTRY,
    id: String(entry.id),
  });
  const changes = validateOrThrow<{
    body?: string;
    subject?: string;
    is_deleted?: boolean;
  }>(
    {
      body: charField({maxLength: BODY_MAX_LENGTH}),
      subject: charField({maxLength: SUBJECT_MAX_LENGTH}),
      is_deleted: booleanField(),
    },
    attributes,
    {partial: true}
  );
  const [updated] = await c
    .get('db')
    .update(textEntries)
    .set({...changes, date_updated: now()})
    .where(eq(textEntries.id, entry.id))
    .returning();
  return resourceResponse(c, TEXT_ENTRY, updated as TextEntry);
};

entryRoutes.patch('/:id', update);
entryRoutes.put('/:id', update);

/** Entries are soft-deleted. */
entryRoutes.delete('/:id', async c => {
  const entry = await getOwned<TextEntry>(
    c,
    owned,
    c.req.param('id'),
    TEXT_ENTRY,
    requireUser(c)
  );
  const [deleted] = await c
    .get('db')
    .update(textEntries)
    .set({is_deleted: true, date_updated: now()})
    .where(eq(textEntries.id, entry.id))
    .returning();
  return resourceResponse(c, TEXT_ENTRY, deleted as TextEntry);
});
