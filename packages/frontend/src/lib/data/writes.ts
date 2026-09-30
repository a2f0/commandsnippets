/**
 * The user's writes: each calls the API, which refuses it unless signed in
 * as the user it names (the signed-in user here, `apiClient.setActingUser`;
 * `UserMismatchError` when another tab has signed in as someone else since,
 * and this tab leaves the session). Then it stores what the API answered in
 * the user's IndexedDB database (`putResources`), so every list shows it at
 * once. A write the API answers with no body (untagging, deleting an entry,
 * reordering) marks what it knows and syncs for the rest.
 *
 * Only the signed-in user's own data is written: a session of another
 * user's (staff reading it) refuses every write before it is sent
 * (`ReadOnlyError`), as the API would.
 */

import type {TagReorderDocument} from '@commandsnippets/api-shared/requests';
import type {
  IncludedResource,
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {apiClient, UserMismatchError} from '../api/apiClient';
import {leaveForeignSession} from '../state/appState';
import type {SyncSession} from '../sync/session';
import {markDeleted, putResources} from '../sync/store';
import {junctionOf} from './hooks';

/** A write to another user's data (a read-only session), never sent. */
export class ReadOnlyError extends Error {
  constructor(owner: string) {
    super(`${owner}'s data is read-only here: not written`);
    this.name = 'ReadOnlyError';
  }
}

/** Refuse any write in a read-only session, before it reads or sends. */
function refuseReadOnly(session: SyncSession): void {
  if (session.readOnly) {
    throw new ReadOnlyError(session.owner);
  }
}

/**
 * Send a write: refused unsent in a read-only session (`ReadOnlyError`);
 * when the API refuses it as another user's, `session`'s tab leaves the
 * session (`leaveForeignSession`), and the write still fails.
 */
async function send<T>(
  session: SyncSession,
  write: () => Promise<T>
): Promise<T> {
  refuseReadOnly(session);
  try {
    return await write();
  } catch (error: unknown) {
    if (error instanceof UserMismatchError) {
      void leaveForeignSession(session.username);
    }
    throw error;
  }
}

/** Store a write's answer: its `data` and `included`. */
async function store(
  session: SyncSession,
  document: {
    data: IncludedResource;
    included?: IncludedResource[] | undefined;
  }
): Promise<void> {
  await putResources(session.db, session.owner, [
    document.data,
    ...(document.included ?? []),
  ]);
}

/** A sync the write does not wait for: its failure is logged. */
function syncLater(sync: Promise<void>): void {
  sync.catch((error: unknown) => {
    console.error('ERROR: sync failed:', error);
  });
}

export async function createTag(
  session: SyncSession,
  name: string
): Promise<Tag> {
  const document = await send(session, () => apiClient.createTag(name));
  await store(session, document);
  return document.data;
}

export async function renameTag(
  session: SyncSession,
  tagId: string,
  name: string
): Promise<Tag> {
  const document = await send(session, () => apiClient.updateTag(tagId, name));
  await store(session, document);
  return document.data;
}

export async function deleteTag(
  session: SyncSession,
  tagId: string
): Promise<void> {
  await store(session, await send(session, () => apiClient.deleteTag(tagId)));
}

/** Move tag `top` above tag `bottom`: the tags sync their new ranks. */
export async function reorderTags(
  session: SyncSession,
  payload: TagReorderDocument
): Promise<void> {
  await send(session, () => apiClient.reorderTag(payload));
  syncLater(session.sync.syncAll());
}

/** Create an entry, in tag `tagId` when given. */
export async function createEntry(
  session: SyncSession,
  subject: string,
  body: string,
  tagId?: string
): Promise<TextEntry> {
  const created = await send(session, () =>
    apiClient.createEntry(subject, body)
  );
  await store(session, created);
  if (tagId !== undefined) {
    await tagEntry(session, tagId, created.data.id);
  }
  return created.data;
}

export async function updateEntry(
  session: SyncSession,
  entryId: string,
  subject: string,
  body: string
): Promise<TextEntry> {
  const document = await send(session, () =>
    apiClient.updateEntry(entryId, subject, body)
  );
  await store(session, document);
  return document.data;
}

/** Delete an entry (the API keeps it, deleted): it leaves every list. */
export async function deleteEntry(
  session: SyncSession,
  entryId: string
): Promise<void> {
  refuseReadOnly(session);
  const entry = await session.db.entries.get([session.owner, entryId]);
  await send(session, () => apiClient.deleteEntry(entryId));
  if (entry !== undefined) {
    await markDeleted(session.db.entries, entry);
  }
  syncLater(session.sync.syncAll());
}

export async function tagEntry(
  session: SyncSession,
  tagId: string,
  entryId: string
): Promise<TagTextEntry> {
  const document = await send(session, () =>
    apiClient.tagEntry(tagId, entryId)
  );
  await store(session, document);
  return document.data;
}

/** Take entry `entryId` out of tag `tagId`. */
export async function untagEntry(
  session: SyncSession,
  tagId: string,
  entryId: string
): Promise<void> {
  refuseReadOnly(session);
  const junction = await junctionOf(session, tagId, entryId);
  if (junction === undefined) {
    return;
  }
  await send(session, () => apiClient.untagEntry(junction.id));
  await markDeleted(session.db.junctions, junction);
  syncLater(session.sync.syncTag(tagId));
}

/**
 * Move entry `topEntryId` above entry `bottomEntryId` in tag `tagId`: the
 * tag syncs their new ranks.
 */
export async function reorderEntries(
  session: SyncSession,
  tagId: string,
  topEntryId: string,
  bottomEntryId: string
): Promise<void> {
  refuseReadOnly(session);
  const [top, bottom] = await Promise.all([
    junctionOf(session, tagId, topEntryId),
    junctionOf(session, tagId, bottomEntryId),
  ]);
  if (top === undefined || bottom === undefined) {
    throw new Error('The entries to reorder are not in the tag');
  }
  await send(session, () => apiClient.reorderEntry(top.id, bottom.id));
  await session.sync.syncTag(tagId);
}
