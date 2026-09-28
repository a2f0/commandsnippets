import {and, eq, sql} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {requireUser} from '../auth/tokens';
import {isUniqueViolation} from '../db/errors';
import {type Tag, tags} from '../db/schema';
import type {AppEnv} from '../env';
import {now, parseDateTime} from '../lib/clock';
import {ApiError, queryError} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {OrderedModel, type OrderedSpec} from '../lib/ordered';
import {revision} from '../lib/revision';
import {booleanField, charField, validateOrThrow} from '../lib/validation';
import {reorder} from './reorder';
import {TAG} from './serializers';
import {getOwned, listResponse, resourceResponse} from './viewset';

const NAME_MAX_LENGTH = 24;

export const tagOrdering: OrderedSpec = {
  table: tags,
  id: tags.id,
  order: tags.order,
  dateUpdated: tags.date_updated,
  scope: tags.user_id,
};

const owned = {table: tags, id: tags.id, userId: tags.user_id};

const uniqueNameError = () =>
  ApiError.of(400, 'The fields name, user must make a unique set.', 'unique');

export const tagRoutes = new Hono<AppEnv>();

tagRoutes.get('/', c =>
  listResponse(c, {
    ...owned,
    type: TAG,
    user: requireUser(c),
    filters: {
      name: value => eq(tags.name, value),
      user__username: value =>
        sql`${tags.user_id} IN (SELECT id FROM users_user WHERE username = ${value})`,
      date_updated__gt: value => {
        const parsed = parseDateTime(value);
        if (parsed === null) {
          throw queryError('Enter a valid date/time.');
        }
        return sql`${tags.date_updated} > ${parsed}`;
      },
    },
    ordering: {
      date_last_used: sql`${tags.date_last_used}`,
      date_created: sql`${tags.date_created}`,
      date_updated: sql`${tags.date_updated}`,
      entry_count: sql`${tags.entry_count}`,
      name: sql`${tags.name} COLLATE NOCASE`,
      order: sql`${tags.order}`,
    },
    defaultOrdering: [tags.date_updated, tags.id],
  })
);

tagRoutes.post('/reorder', c =>
  reorder(c, {
    ...tagOrdering,
    type: TAG,
    userId: tags.user_id,
  })
);

tagRoutes.get('/:id', async c => {
  const tag = await getOwned<Tag>(
    c,
    owned,
    c.req.param('id'),
    TAG,
    requireUser(c)
  );
  return resourceResponse(c, TAG, tag);
});

/**
 * Create a tag, or return the user's existing tag of the same name
 * (resurrecting it if it was soft-deleted). Always 201, as in Django.
 */
tagRoutes.post('/', async c => {
  const user = requireUser(c);
  const db = c.get('db');
  const {attributes} = await parseResource(c.req.raw, {type: TAG});

  const findByName = async (name: string) =>
    (
      await db
        .select()
        .from(tags)
        .where(and(eq(tags.user_id, user.id), eq(tags.name, name)))
        .limit(1)
    )[0];

  if (typeof attributes['name'] === 'string') {
    const existing = await findByName(attributes['name'].trim());
    if (existing !== undefined) {
      if (!existing.is_deleted) {
        return resourceResponse(c, TAG, existing, 201);
      }
      const [resurrected] = await db
        .update(tags)
        .set({
          is_deleted: false,
          date_updated: revision(
            tags,
            tags.date_updated,
            tags.user_id,
            user.id
          ),
        })
        .where(eq(tags.id, existing.id))
        .returning();
      return resourceResponse(c, TAG, resurrected as Tag, 201);
    }
  }

  const {name} = validateOrThrow<{name: string}>(
    {name: charField({maxLength: NAME_MAX_LENGTH})},
    attributes
  );
  const timestamp = now();
  try {
    const [created] = await db
      .insert(tags)
      .values({
        name,
        user_id: user.id,
        order: new OrderedModel(db, tagOrdering).nextOrderSql(user.id),
        date_created: timestamp,
        date_updated: revision(tags, tags.date_updated, tags.user_id, user.id),
        date_last_used: timestamp,
      })
      .returning();
    return resourceResponse(c, TAG, created as Tag, 201);
  } catch (error) {
    // Lost a race with a concurrent create of the same name.
    const existing = isUniqueViolation(error)
      ? await findByName(name)
      : undefined;
    if (existing === undefined) {
      throw error;
    }
    return resourceResponse(c, TAG, existing, 201);
  }
});

const update = async (c: Context<AppEnv>) => {
  const user = requireUser(c);
  const db = c.get('db');
  const tag = await getOwned<Tag>(c, owned, c.req.param('id'), TAG, user);
  const {attributes} = await parseResource(c.req.raw, {
    type: TAG,
    id: String(tag.id),
  });
  const changes = validateOrThrow<{name?: string; is_deleted?: boolean}>(
    {
      name: charField({maxLength: NAME_MAX_LENGTH}),
      is_deleted: booleanField(),
    },
    attributes,
    {partial: true}
  );
  try {
    const [updated] = await db
      .update(tags)
      .set({
        ...changes,
        date_updated: revision(tags, tags.date_updated, tags.user_id, user.id),
      })
      .where(eq(tags.id, tag.id))
      .returning();
    return resourceResponse(c, TAG, updated as Tag);
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw uniqueNameError();
    }
    throw error;
  }
};

tagRoutes.patch('/:id', update);
tagRoutes.put('/:id', update);

/** Tags are soft-deleted. */
tagRoutes.delete('/:id', async c => {
  const tag = await getOwned<Tag>(
    c,
    owned,
    c.req.param('id'),
    TAG,
    requireUser(c)
  );
  const [deleted] = await c
    .get('db')
    .update(tags)
    .set({
      is_deleted: true,
      date_updated: revision(
        tags,
        tags.date_updated,
        tags.user_id,
        tag.user_id
      ),
    })
    .where(eq(tags.id, tag.id))
    .returning();
  return resourceResponse(c, TAG, deleted as Tag);
});
