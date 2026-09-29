/**
 * The user's writes: each first asks the API whose account it answers for
 * (`SyncEngine.verifyOwner`), and writes only to the database's user's; then
 * calls the API and stores what it answered in the user's IndexedDB database
 * (`putResources`, that user's rows only), so every list shows it at once. A
 * write the API answers with no body (untagging, deleting an entry,
 * reordering) marks what it knows and syncs for the rest.
 */

import type {TagReorderDocument} from '@commandsnippets/api-shared/requests';
import type {
  IncludedResource,
  Tag,
  TagTextEntry,
  TextEntry,
} from '@commandsnippets/api-shared/responses';
import {apiClient} from '../api/apiClient';
import type {SyncSession} from '../sync/session';
import {checkOwner, markDeleted, putResources} from '../sync/store';
import {junctionOf} from './hooks';

/** The API's user id, when it is the database's: `SyncUserError` when not. */
const ownerOf = (session: SyncSession) => session.sync.verifyOwner();

/** Store a write's answer (its `data` and `included`), the owner's rows only. */
async function store(
  session: SyncSession,
  owner: string,
  document: {
    data: IncludedResource;
    included?: IncludedResource[] | undefined;
  }
): Promise<void> {
  const resources = [document.data, ...(document.included ?? [])];
  checkOwner(owner, resources);
  await putResources(session.db, resources);
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
  const owner = await ownerOf(session);
  const document = await apiClient.createTag(name);
  await store(session, owner, document);
  return document.data;
}

export async function renameTag(
  session: SyncSession,
  tagId: string,
  name: string
): Promise<Tag> {
  const owner = await ownerOf(session);
  const document = await apiClient.updateTag(tagId, name);
  await store(session, owner, document);
  return document.data;
}

export async function deleteTag(
  session: SyncSession,
  tagId: string
): Promise<void> {
  const owner = await ownerOf(session);
  await store(session, owner, await apiClient.deleteTag(tagId));
}

/** Move tag `top` above tag `bottom`: the tags sync their new ranks. */
export async function reorderTags(
  session: SyncSession,
  payload: TagReorderDocument
): Promise<void> {
  await ownerOf(session);
  await apiClient.reorderTag(payload);
  syncLater(session.sync.syncAll());
}

/** Create an entry, in tag `tagId` when given. */
export async function createEntry(
  session: SyncSession,
  subject: string,
  body: string,
  tagId?: string
): Promise<TextEntry> {
  const owner = await ownerOf(session);
  const created = await apiClient.createEntry(subject, body);
  await store(session, owner, created);
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
  const owner = await ownerOf(session);
  const document = await apiClient.updateEntry(entryId, subject, body);
  await store(session, owner, document);
  return document.data;
}

/** Delete an entry (the API keeps it, deleted): it leaves every list. */
export async function deleteEntry(
  session: SyncSession,
  entryId: string
): Promise<void> {
  await ownerOf(session);
  const entry = await session.db.entries.get(entryId);
  await apiClient.deleteEntry(entryId);
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
  const owner = await ownerOf(session);
  const document = await apiClient.tagEntry(tagId, entryId);
  await store(session, owner, document);
  return document.data;
}

/** Take entry `entryId` out of tag `tagId`. */
export async function untagEntry(
  session: SyncSession,
  tagId: string,
  entryId: string
): Promise<void> {
  const junction = await junctionOf(session.db, tagId, entryId);
  if (junction === undefined) {
    return;
  }
  await ownerOf(session);
  await apiClient.untagEntry(junction.id);
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
  const [top, bottom] = await Promise.all([
    junctionOf(session.db, tagId, topEntryId),
    junctionOf(session.db, tagId, bottomEntryId),
  ]);
  if (top === undefined || bottom === undefined) {
    throw new Error('The entries to reorder are not in the tag');
  }
  await ownerOf(session);
  await apiClient.reorderEntry(top.id, bottom.id);
  await session.sync.syncTag(tagId);
}
