/**
 * `POST /tags`: create a tag (201), or answer with the user's existing tag
 * of the same name (200; resurrected if it was soft-deleted). One naming a
 * `client_id` the user's tags already have answers with that tag, whatever
 * it is called now, as its first attempt was answered (201 when that attempt
 * made the tag): a queued create retried after a lost answer is made once.
 */
import {tagCreateAttributesSchema} from '@commandsnippets/api-shared';
import {and, eq, inArray, type SQL, sql} from 'drizzle-orm';
import type {Context} from 'hono';
import * as z from 'zod/mini';
import {requireUser} from '../auth/permissions';
import type {Db} from '../db/client';
import {isNotNullViolation, isUniqueViolation} from '../db/errors';
import {type Tag, tagClientIds, tags, type User} from '../db/schema';
import type {AppEnv} from '../env';
import {now} from '../lib/clock';
import {parseResource} from '../lib/jsonapi/request';
import {OrderedModel} from '../lib/ordered';
import {validateFields} from '../lib/validate';
import {versionOf} from './dataVersions';
import {appliesAfter, clientUpdated, retryWrite, writtenBefore} from './lww';
import {tagOrdering} from './orderings';
import {nextRevision, tagResource} from './owned';
import {TAG} from './resourceTypes';
import {resourceResponse} from './viewset';

/** A create, as the request makes it. */
interface TagCreate {
  db: Db;
  user: User;
  version: number;
  clientId: string | undefined;
  /** When it was made (`clientUpdated`). */
  at: string;
  attributes: Record<string, unknown>;
  /** The name asked for, as the name field reads it (a number is its string). */
  named: string | undefined;
}

/** What a create reads before it writes. */
interface TagRead {
  /**
   * The tag this create made, or was answered with, before (its answer was
   * lost): by its client id, whatever the tag is named by then.
   */
  made: Tag | undefined;
  /** The user's tag of the name asked for. */
  existing: Tag | undefined;
}

const madeQuery = ({db, user, version, clientId}: TagCreate) =>
  clientId === undefined
    ? undefined
    : db
        .select()
        .from(tags)
        .where(
          and(
            eq(tags.version, version),
            inArray(
              tags.id,
              db
                .select({id: tagClientIds.tag_id})
                .from(tagClientIds)
                .where(
                  and(
                    eq(tagClientIds.user_id, user.id),
                    eq(tagClientIds.version, version),
                    eq(tagClientIds.client_id, clientId)
                  )
                )
            )
          )
        )
        .limit(1);

const namedQuery = ({db, user, version}: TagCreate, name: string) =>
  db
    .select()
    .from(tags)
    .where(
      and(
        eq(tags.user_id, user.id),
        eq(tags.version, version),
        eq(tags.name, name)
      )
    )
    .limit(1);

/** The made and the named tag, in one round trip when it reads both. */
async function readTag(create: TagCreate): Promise<TagRead> {
  const made = madeQuery(create);
  const named =
    create.named === undefined ? undefined : namedQuery(create, create.named);
  if (made === undefined || named === undefined) {
    const [[madeRow] = [], [existing] = []] = await Promise.all([made, named]);
    return {made: madeRow, existing};
  }
  const [[madeRow], [existing]] = await create.db.batch([made, named]);
  return {made: madeRow, existing};
}

/**
 * The statement reserving the create's client id for the tag `which` finds
 * when it runs, ending the batch of the write it answers with: so the
 * client id names one tag, the one the create was answered with. A clash
 * (another attempt of this create reserved it first) or no such tag any
 * more fails the batch, which is undone, and the create reads again.
 */
const reserve = ({db, user, version, clientId}: TagCreate, which: SQL) =>
  db.insert(tagClientIds).values({
    user_id: user.id,
    version,
    client_id: clientId ?? '',
    tag_id: sql`(SELECT ${tags.id} FROM ${tags} WHERE ${which})`,
  });

/** The batch failed to another write: the create reads again. */
const lostRace = (error: unknown) =>
  isUniqueViolation(error) ||
  isNotNullViolation(error, 'tags_tagclientid.tag_id');

/**
 * Answer with the user's tag of the name, written only while still as read
 * (named so, deleted or not as read): resurrected if it was deleted, else
 * stamped with the create's time. Undefined when a write landed between
 * the read and this one (a rename, a delete, a concurrent create).
 */
async function reviveOrStamp(
  create: TagCreate,
  existing: Tag
): Promise<Tag | undefined> {
  const {db, user, clientId, at} = create;
  const asRead =
    and(
      eq(tags.id, existing.id),
      eq(tags.name, existing.name),
      eq(tags.is_deleted, existing.is_deleted)
    ) ?? sql`0`;
  // Deleted (or created) after this create was made: that stands.
  if (!appliesAfter(existing.client_updated, at)) {
    if (clientId !== undefined) {
      await reserve(create, asRead);
    }
    return existing;
  }
  const update = db
    .update(tags)
    .set(
      existing.is_deleted
        ? {
            is_deleted: false,
            client_updated: at,
            date_updated: nextRevision(tagResource, user.id),
          }
        : // Still a write made at `at`, which an older delete must not
          // undo. Nothing a client syncs changes: no revision advances.
          {client_updated: at}
    )
    .where(and(asRead, writtenBefore(tags.client_updated, at)))
    .returning();
  if (clientId === undefined) {
    return (await update)[0];
  }
  const [[written]] = await db.batch([
    update,
    // The tag as this update left it.
    reserve(
      create,
      and(
        eq(tags.id, existing.id),
        eq(tags.name, existing.name),
        eq(tags.is_deleted, false),
        eq(tags.client_updated, at)
      ) ?? sql`0`
    ),
  ]);
  return written;
}

/** A new tag of the name, at the bottom of the user's tags. */
async function insertTag(create: TagCreate): Promise<Tag> {
  const {db, user, version, clientId, at, attributes} = create;
  const {name} = validateFields(tagCreateAttributesSchema, attributes);
  const timestamp = now();
  const insert = db
    .insert(tags)
    .values({
      name,
      user_id: user.id,
      version,
      order: new OrderedModel(db, tagOrdering).nextOrderSql(user.id),
      date_created: timestamp,
      date_updated: nextRevision(tagResource, user.id),
      date_last_used: timestamp,
      client_id: clientId ?? null,
      client_updated: at,
    })
    .returning();
  const [created] =
    clientId === undefined
      ? await insert
      : (
          await db.batch([
            insert,
            reserve(
              create,
              and(
                eq(tags.user_id, user.id),
                eq(tags.version, version),
                eq(tags.name, name)
              ) ?? sql`0`
            ),
          ])
        )[0];
  if (created === undefined) {
    throw new Error(`creating tag ${name} returned no row`);
  }
  return created;
}

/**
 * One attempt of a create, on what it read: the response, or undefined when
 * it lost a race (with a concurrent create of the name, or with another
 * attempt of this create, whose tag the next attempt answers with).
 */
async function attemptCreate(
  c: Context<AppEnv>,
  create: TagCreate,
  {made, existing}: TagRead
): Promise<Response | undefined> {
  if (made !== undefined) {
    const status = made.client_id === create.clientId ? 201 : 200;
    return resourceResponse(c, TAG, made, status);
  }
  try {
    if (existing !== undefined) {
      const written = await reviveOrStamp(create, existing);
      return written === undefined
        ? undefined
        : resourceResponse(c, TAG, written, 200);
    }
    return resourceResponse(c, TAG, await insertTag(create), 201);
  } catch (error) {
    if (!lostRace(error)) {
      throw error;
    }
    return undefined;
  }
}

export async function createTag(c: Context<AppEnv>): Promise<Response> {
  const user = requireUser(c);
  const version = versionOf(c, user);
  const {attributes} = await parseResource(c.req.raw, {type: TAG});
  const {client_id: clientId} = validateFields(
    z.pick(tagCreateAttributesSchema, {client_id: true}),
    attributes
  );
  const name = attributes['name'];
  const create: TagCreate = {
    db: c.get('db'),
    user,
    version,
    clientId,
    at: await clientUpdated(c),
    attributes,
    named:
      typeof name === 'string' || typeof name === 'number'
        ? String(name).trim()
        : undefined,
  };
  return retryWrite(
    await readTag(create),
    () => readTag(create),
    read => attemptCreate(c, create, read),
    'tag'
  );
}
