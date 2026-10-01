/**
 * The user's writes, local first: each changes the IndexedDB database at once
 * and queues itself for the API in the same transaction (`lib/sync/outbox.ts`),
 * so every list shows it at once, online or not, and nothing waits on the
 * network. Then the queue is flushed, not waited for: the API's answers
 * replace the local rows as they come.
 *
 * Writes mirror what the API does with them: a new tag or junction goes to
 * the bottom, a tag of a name the user has is that tag, a reorder moves a row
 * directly above another (by giving it an order between its new neighbors',
 * until the API's ranks are synced). Rows made here have local ids until the
 * API's replace them.
 *
 * Only the signed-in user's own data is written: a session of another
 * user's (staff reading it) refuses every write (`ReadOnlyError`), as the API
 * would.
 */

import {
  tagCreateAttributesSchema,
  tagUpdateAttributesSchema,
  textEntryCreateAttributesSchema,
  textEntryUpdateAttributesSchema,
} from '@commandsnippets/api-shared/requests';
import type {
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import type {Table} from 'dexie';
import type * as z from 'zod/mini';
import {UserMismatchError} from '../api/apiClient';
import type {QueuedWrite, RowKey, Stored} from '../db/database';
import {leaveForeignSession} from '../state/appState';
import {enqueue, isLocalId, localId, madeNow} from '../sync/outbox';
import type {SyncSession} from '../sync/session';
import {junctionOf} from './hooks';

/**
 * A write the API would refuse (a blank or too long field, a tag name the
 * user has), never made: nothing is stored or queued, and the editor that
 * made it keeps it, to be fixed. Writes are checked here, as the API checks
 * them, because a queued write the API refuses is dropped.
 */
export class InvalidWriteError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidWriteError';
  }
}

/** `fields` as the API's schema reads them, or InvalidWriteError. */
function checked<S extends z.ZodMiniType>(
  schema: S,
  fields: Record<string, unknown>
): z.output<S> {
  const result = schema.safeParse(fields);
  if (!result.success) {
    const [issue] = result.error.issues;
    throw new InvalidWriteError(
      `${issue?.path.join('.') ?? 'fields'}: ${issue?.message ?? 'invalid'}`
    );
  }
  return result.data;
}

/** A write to another user's data (a read-only session), never made. */
export class ReadOnlyError extends Error {
  constructor(owner: string) {
    super(`${owner}'s data is read-only here: not written`);
    this.name = 'ReadOnlyError';
  }
}

/** Refuse any write in a read-only session, before it reads or writes. */
function refuseReadOnly(session: SyncSession): void {
  if (session.readOnly) {
    throw new ReadOnlyError(session.owner);
  }
}

/**
 * A flush that failed: it is tried again later (on the next write, sync or
 * coming back online). When the API answers as another user (another tab
 * signed in as someone else), this tab leaves the session; when the user
 * signed out meanwhile, there is nothing left to send.
 */
export function flushFailed(session: SyncSession, error: unknown): void {
  if (error instanceof UserMismatchError) {
    void leaveForeignSession(session.username);
    return;
  }
  // Signed out meanwhile: the database (and its queue) is gone.
  if (error instanceof Error && error.name === 'DatabaseClosedError') {
    return;
  }
  console.warn('WARNING: queued writes not sent yet:', error);
}

/** Send the queued writes, not waited for. */
function flushSoon(session: SyncSession): void {
  session.sync.flush().catch((error: unknown) => flushFailed(session, error));
}

/**
 * Make a write: `change` changes the database and returns the writes to
 * queue (made now) with its result, all in one transaction; then the queue
 * is flushed.
 */
async function write<T>(
  session: SyncSession,
  change: () => Promise<{writes: QueuedWrite[]; result: T}>
): Promise<T> {
  refuseReadOnly(session);
  const {db, owner} = session;
  const made = madeNow();
  const result = await db.transaction(
    'rw',
    [db.tags, db.entries, db.junctions, db.outbox],
    async () => {
      const {writes, result} = await change();
      for (const queued of writes) {
        await enqueue(db, owner, queued, made);
      }
      return result;
    }
  );
  flushSoon(session);
  return result;
}

/**
 * The row `id` names: the row of that id, or for a local id the API's id has
 * replaced meanwhile (an editor opened before its create was sent), the row
 * holding it (`localId`).
 */
async function rowNamed<R>(
  table: Table<Stored<R>, RowKey>,
  owner: string,
  id: string
): Promise<Stored<R> | undefined> {
  const row = await table.get([owner, id]);
  if (row !== undefined || !isLocalId(id)) {
    return row;
  }
  return table
    .where('owner')
    .equals(owner)
    .filter(candidate => candidate.localId === id)
    .first();
}

/** The id the row `id` names has now (see `rowNamed`). */
async function idNow<R extends {id: string}>(
  table: Table<Stored<R>, RowKey>,
  owner: string,
  id: string
): Promise<string> {
  return (await rowNamed(table, owner, id))?.id ?? id;
}

/** The owner's user id, for a row made here (a stored row's, if any). */
async function ownerIdOf(session: SyncSession): Promise<string> {
  const {db, owner} = session;
  const row =
    (await db.tags.where('owner').equals(owner).first()) ??
    (await db.entries.where('owner').equals(owner).first());
  return row?.relationships.user.data.id ?? '';
}

/** The order after the last of `orders` (the bottom), 0 for none. */
const bottomOf = (orders: number[]) =>
  orders.length === 0 ? 0 : Math.max(...orders) + 1;

/**
 * The order that puts a row directly above `bottom` among `ranked` (sorted
 * by order, without the row moved): between `bottom`'s and its upper
 * neighbor's.
 */
function orderAbove<R extends {id: string; attributes: {order: number}}>(
  ranked: R[],
  bottom: R
): number {
  const index = ranked.findIndex(row => row.id === bottom.id);
  const above = index > 0 ? ranked[index - 1] : undefined;
  return above === undefined
    ? bottom.attributes.order - 1
    : (above.attributes.order + bottom.attributes.order) / 2;
}

const byOrder = (a: {attributes: {order: number}}, b: typeof a) =>
  a.attributes.order - b.attributes.order;

export async function createTag(
  session: SyncSession,
  rawName: string
): Promise<Tag> {
  const {db, owner} = session;
  refuseReadOnly(session);
  const {name} = checked(tagCreateAttributesSchema, {name: rawName});
  return write(session, async () => {
    const tags = await db.tags.where('owner').equals(owner).toArray();
    const named = tags.find(tag => tag.attributes.name === name);
    if (named !== undefined) {
      // The user's tag of the name: kept by id (brought back if deleted),
      // and the API records when it was asked for, so an older delete
      // (another device's, sent later) does not win. Never a new tag of the
      // name, should it be renamed elsewhere meanwhile.
      const kept = named.attributes.is_deleted
        ? {...named, attributes: {...named.attributes, is_deleted: false}}
        : named;
      await db.tags.put(kept);
      return {writes: [{kind: 'keepTag', tagId: named.id}], result: kept};
    }
    const made = madeNow();
    const tag: Stored<Tag> = {
      type: 'Tag',
      id: localId(),
      owner,
      attributes: {
        name,
        date_created: made,
        date_last_used: made,
        date_updated: made,
        entry_count: 0,
        order: bottomOf(tags.map(other => other.attributes.order)),
        is_deleted: false,
      },
      relationships: {
        user: {data: {type: 'User', id: await ownerIdOf(session)}},
      },
    };
    await db.tags.put(tag);
    return {writes: [{kind: 'createTag', tagId: tag.id, name}], result: tag};
  });
}

/** Rename tag `tagId` (null when there is no such tag). */
export async function renameTag(
  session: SyncSession,
  tagId: string,
  rawName: string
): Promise<Tag | null> {
  const {db, owner} = session;
  refuseReadOnly(session);
  const {name = ''} = checked(tagUpdateAttributesSchema, {name: rawName});
  return write(session, async () => {
    const tag = await rowNamed(db.tags, owner, tagId);
    if (tag === undefined) {
      return {writes: [], result: null};
    }
    // A user's tags have unique names, deleted ones' included.
    const taken = await db.tags
      .where('owner')
      .equals(owner)
      .filter(other => other.id !== tag.id && other.attributes.name === name)
      .count();
    if (taken > 0) {
      throw new InvalidWriteError(`name: ${name} is taken`);
    }
    const renamed = {...tag, attributes: {...tag.attributes, name}};
    await db.tags.put(renamed);
    return {
      writes: [{kind: 'renameTag', tagId: tag.id, name}],
      result: renamed,
    };
  });
}

export async function deleteTag(
  session: SyncSession,
  tagId: string
): Promise<void> {
  const {db, owner} = session;
  await write(session, async () => {
    const tag = await rowNamed(db.tags, owner, tagId);
    if (tag === undefined) {
      return {writes: [], result: undefined};
    }
    await db.tags.put({
      ...tag,
      attributes: {...tag.attributes, is_deleted: true},
    });
    return {writes: [{kind: 'deleteTag', tagId: tag.id}], result: undefined};
  });
}

/** Move tag `top` directly above tag `bottom`. */
export async function reorderTags(
  session: SyncSession,
  topId: string,
  bottomId: string
): Promise<void> {
  const {db, owner} = session;
  await write(session, async () => {
    const top = await idNow(db.tags, owner, topId);
    const bottom = await idNow(db.tags, owner, bottomId);
    const tags = (await db.tags.where('owner').equals(owner).toArray())
      .filter(tag => !tag.attributes.is_deleted)
      .sort(byOrder);
    const moved = tags.find(tag => tag.id === top);
    const below = tags.find(tag => tag.id === bottom);
    if (moved === undefined || below === undefined || top === bottom) {
      return {writes: [], result: undefined};
    }
    await db.tags.put({
      ...moved,
      attributes: {
        ...moved.attributes,
        order: orderAbove(
          tags.filter(tag => tag.id !== top),
          below
        ),
      },
    });
    return {writes: [{kind: 'reorderTags', top, bottom}], result: undefined};
  });
}

/** Store a new junction putting entry `entryId` at the bottom of `tagId`. */
async function newJunction(
  session: SyncSession,
  tagId: string,
  entryId: string,
  made: string
): Promise<Stored<TagTextEntry>> {
  const {db, owner} = session;
  const inTag = await db.junctions
    .where('[owner+relationships.tag.data.id]')
    .equals([owner, tagId])
    .filter(junction => !junction.attributes.is_deleted)
    .toArray();
  const junction: Stored<TagTextEntry> = {
    type: 'TagTextEntryThroughModel',
    id: localId(),
    owner,
    attributes: {
      order: bottomOf(inTag.map(other => other.attributes.order)),
      date_created: made,
      date_updated: made,
      is_deleted: false,
    },
    relationships: {
      tag: {data: {type: 'Tag', id: tagId}},
      text_entry: {data: {type: 'TextEntry', id: entryId}},
      user: {data: {type: 'User', id: await ownerIdOf(session)}},
    },
  };
  await db.junctions.put(junction);
  return junction;
}

/** Create an entry, in tag `tagId` when given. */
export async function createEntry(
  session: SyncSession,
  subject: string,
  body: string,
  tagId?: string
): Promise<TextEntry> {
  const {db, owner} = session;
  refuseReadOnly(session);
  const fields = checked(textEntryCreateAttributesSchema, {subject, body});
  return write(session, async () => {
    const made = madeNow();
    const entry: Stored<TextEntry> = {
      type: 'TextEntry',
      id: localId(),
      owner,
      attributes: {
        subject: fields.subject,
        body: fields.body,
        date_created: made,
        date_updated: made,
        reused_count: 0,
        is_deleted: false,
        tag_count: tagId === undefined ? 0 : 1,
      },
      relationships: {
        user: {data: {type: 'User', id: await ownerIdOf(session)}},
        text_entry_to_tag: {data: [], meta: {count: 0}},
      },
    };
    await db.entries.put(entry);
    const tagNow =
      tagId === undefined ? undefined : await idNow(db.tags, owner, tagId);
    const writes: QueuedWrite[] = [
      {
        kind: 'createEntry',
        entryId: entry.id,
        subject: entry.attributes.subject,
        body: entry.attributes.body,
      },
    ];
    if (tagNow !== undefined) {
      const junction = await newJunction(session, tagNow, entry.id, made);
      writes.push({
        kind: 'tagEntry',
        junctionId: junction.id,
        tagId: tagNow,
        entryId: entry.id,
      });
    }
    return {writes, result: entry};
  });
}

/** Edit entry `entryId` (null when there is no such entry). */
export async function updateEntry(
  session: SyncSession,
  entryId: string,
  rawSubject: string,
  rawBody: string
): Promise<TextEntry | null> {
  const {db, owner} = session;
  refuseReadOnly(session);
  const {subject = '', body = ''} = checked(textEntryUpdateAttributesSchema, {
    subject: rawSubject,
    body: rawBody,
  });
  return write(session, async () => {
    const entry = await rowNamed(db.entries, owner, entryId);
    if (entry === undefined) {
      return {writes: [], result: null};
    }
    const edited = {
      ...entry,
      attributes: {...entry.attributes, subject, body, date_updated: madeNow()},
    };
    await db.entries.put(edited);
    return {
      writes: [{kind: 'updateEntry', entryId: entry.id, subject, body}],
      result: edited,
    };
  });
}

/** Delete an entry (the API keeps it, deleted): it leaves every list. */
export async function deleteEntry(
  session: SyncSession,
  entryId: string
): Promise<void> {
  const {db, owner} = session;
  await write(session, async () => {
    const entry = await rowNamed(db.entries, owner, entryId);
    if (entry === undefined) {
      return {writes: [], result: undefined};
    }
    await db.entries.put({
      ...entry,
      attributes: {
        ...entry.attributes,
        is_deleted: true,
        date_updated: madeNow(),
      },
    });
    return {
      writes: [{kind: 'deleteEntry', entryId: entry.id}],
      result: undefined,
    };
  });
}

/** Put entry `entryId` in tag `tagId` (at the bottom), unless it is there. */
export async function tagEntry(
  session: SyncSession,
  tagIdGiven: string,
  entryIdGiven: string
): Promise<TagTextEntry> {
  const {db, owner} = session;
  return write(session, async () => {
    const tagId = await idNow(db.tags, owner, tagIdGiven);
    const entryId = await idNow(db.entries, owner, entryIdGiven);
    const pair = await db.junctions
      .where('[owner+relationships.tag.data.id]')
      .equals([owner, tagId])
      .filter(junction => junction.relationships.text_entry.data.id === entryId)
      .first();
    if (pair !== undefined && !pair.attributes.is_deleted) {
      // Nothing changes here, but the API records when the entry was tagged:
      // an older untag (another device's, sent later) must not win.
      return {
        writes: [{kind: 'tagEntry', junctionId: pair.id, tagId, entryId}],
        result: pair,
      };
    }
    const made = madeNow();
    let junction: Stored<TagTextEntry>;
    if (pair === undefined) {
      junction = await newJunction(session, tagId, entryId, made);
    } else {
      // The pair's deleted junction comes back, at the bottom (as on the API).
      const inTag = await db.junctions
        .where('[owner+relationships.tag.data.id]')
        .equals([owner, tagId])
        .filter(other => !other.attributes.is_deleted)
        .toArray();
      junction = {
        ...pair,
        attributes: {
          ...pair.attributes,
          is_deleted: false,
          order: bottomOf(inTag.map(other => other.attributes.order)),
          date_created: made,
        },
      };
      await db.junctions.put(junction);
    }
    return {
      writes: [{kind: 'tagEntry', junctionId: junction.id, tagId, entryId}],
      result: junction,
    };
  });
}

/** Take entry `entryId` out of tag `tagId`. */
export async function untagEntry(
  session: SyncSession,
  tagIdGiven: string,
  entryIdGiven: string
): Promise<void> {
  refuseReadOnly(session);
  const {db, owner} = session;
  await write(session, async () => {
    const tagId = await idNow(db.tags, owner, tagIdGiven);
    const entryId = await idNow(db.entries, owner, entryIdGiven);
    const junction = await junctionOf(session, tagId, entryId);
    if (junction === undefined) {
      return {writes: [], result: undefined};
    }
    await session.db.junctions.put({
      ...junction,
      attributes: {...junction.attributes, is_deleted: true},
    });
    return {
      writes: [{kind: 'untagEntry', junctionId: junction.id, tagId, entryId}],
      result: undefined,
    };
  });
}

/** Move entry `topEntryId` directly above entry `bottomEntryId` in tag `tagId`. */
export async function reorderEntries(
  session: SyncSession,
  tagIdGiven: string,
  topEntryIdGiven: string,
  bottomEntryIdGiven: string
): Promise<void> {
  refuseReadOnly(session);
  const {db, owner} = session;
  await write(session, async () => {
    const tagId = await idNow(db.tags, owner, tagIdGiven);
    const topEntryId = await idNow(db.entries, owner, topEntryIdGiven);
    const bottomEntryId = await idNow(db.entries, owner, bottomEntryIdGiven);
    const inTag = (
      await session.db.junctions
        .where('[owner+relationships.tag.data.id]')
        .equals([session.owner, tagId])
        .filter(junction => !junction.attributes.is_deleted)
        .toArray()
    ).sort(byOrder);
    const ofEntry = (entryId: string) =>
      inTag.find(
        junction => junction.relationships.text_entry.data.id === entryId
      );
    const top = ofEntry(topEntryId);
    const bottom = ofEntry(bottomEntryId);
    if (top === undefined || bottom === undefined) {
      throw new Error('The entries to reorder are not in the tag');
    }
    if (top.id === bottom.id) {
      return {writes: [], result: undefined};
    }
    await session.db.junctions.put({
      ...top,
      attributes: {
        ...top.attributes,
        order: orderAbove(
          inTag.filter(junction => junction.id !== top.id),
          bottom
        ),
      },
    });
    return {
      writes: [{kind: 'reorderEntries', tagId, top: top.id, bottom: bottom.id}],
      result: undefined,
    };
  });
}
