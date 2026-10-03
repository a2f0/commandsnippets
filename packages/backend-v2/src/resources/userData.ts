/** One user URL: full reads for owner/staff, filtered reads for everyone else. */
import {
  CODES,
  DATA_ACCESS_HEADER,
  DATA_OWNER_ID_HEADER,
  PUBLIC_REVISION_HEADER,
} from '@commandsnippets/api-shared';
import {eq} from 'drizzle-orm';
import {type Context, Hono} from 'hono';
import {type User, users} from '../db/schema';
import type {AppEnv} from '../env';
import {ApiError, notFound} from '../lib/errors';
import {document} from '../lib/jsonapi';
import {listEntries} from './entries';
import {jsonApi} from './responses';
import {listTags} from './tags';
import {listTagEntries} from './tagsEntries';

export const userDataRoutes = new Hono<AppEnv>();
const changed = () =>
  ApiError.of(
    409,
    'The public view changed. Restart the sync.',
    CODES.viewChanged
  );

async function readUser(c: Context<AppEnv>): Promise<User> {
  const [owner] = await c
    .get('db')
    .select()
    .from(users)
    .where(eq(users.username, c.req.param('username') ?? ''))
    .limit(1);
  if (owner === undefined) throw notFound('No user matches the given query.');
  return owner;
}

async function read(
  c: Context<AppEnv>,
  respond: (owner: User, publicOnly: boolean) => Promise<Response>
): Promise<Response> {
  const owner = await readUser(c);
  const actor = c.get('user');
  const full = actor !== null && (actor.id === owner.id || actor.is_staff);
  const requested = c.req.header(DATA_ACCESS_HEADER);
  const publicOnly = requested === 'public' || !full;
  if (requested === 'full' && !full) throw changed();
  if (
    publicOnly &&
    (!owner.is_active || owner.date_marked_for_deletion !== null)
  ) {
    throw notFound('No user matches the given query.');
  }
  const expectedOwner = c.req.header(DATA_OWNER_ID_HEADER);
  if (expectedOwner !== undefined && expectedOwner !== String(owner.id))
    throw changed();
  const expected = c.req.header(PUBLIC_REVISION_HEADER);
  if (
    publicOnly &&
    expected !== undefined &&
    expected !== String(owner.public_revision)
  )
    throw changed();
  const response = await respond(owner, publicOnly);
  // Serialization performs several reads. Never return a response built
  // across a privacy change, even when it happened on the final page.
  if (publicOnly) {
    const current = await readUser(c);
    if (
      current.id !== owner.id ||
      current.public_revision !== owner.public_revision ||
      !current.is_active ||
      current.date_marked_for_deletion !== null
    )
      throw changed();
  }
  response.headers.set('Cache-Control', 'no-store');
  response.headers.set(
    'Vary',
    'Cookie, Authorization, X-Data-Access, X-Public-Revision'
  );
  return response;
}

userDataRoutes.get('/:username', c =>
  read(c, async (owner, publicOnly) =>
    jsonApi(
      c,
      document({
        type: 'DataOwner',
        id: String(owner.id),
        attributes: {
          username: owner.username,
          access: publicOnly ? 'public' : 'full',
          public_revision: owner.public_revision,
        },
      })
    )
  )
);
userDataRoutes.get('/:username/tags', c =>
  read(c, (owner, publicOnly) => listTags(c, owner, publicOnly))
);
userDataRoutes.get('/:username/entries', c =>
  read(c, (owner, publicOnly) => listEntries(c, owner, publicOnly))
);
userDataRoutes.get('/:username/tags_entries', c =>
  read(c, (owner, publicOnly) => listTagEntries(c, owner, publicOnly))
);
