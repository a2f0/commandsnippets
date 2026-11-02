/** How a queued write is sent to the API, and what it brings back. */
import {CURSOR_START, cursorOf} from '@commandsnippets/api-shared/cursor';
import type {TagReorderDocument} from '@commandsnippets/api-shared/requests';
import type {
  IncludedResource,
  TagCursorListDocument,
  TagDocument,
  TagTextEntryCursorListDocument,
  TagTextEntryDocument,
  TagTextEntryListDocument,
  TextEntryDocument,
  TextEntryReusedDocument,
  TextEntryReusedListDocument,
} from '@commandsnippets/api-shared/responses';
import {ApiRequestError} from '../api/errors';
import type {QueuedWrite} from '../db/database';
import {JUNCTION, TAG, TEXT_ENTRY} from './queuedWrite';

/** The API calls the queue makes (`apiClient`'s). */
export interface OutboxApi {
  /** These calls, naming the queued write `writeId` (`Client-Write-Id`). */
  forWrite(writeId: string): OutboxApi;
  /** These calls, naming the account `userId` (`X-Expected-User-Id`). */
  forAccount(userId: string): OutboxApi;
  /** These calls, naming the data version `version` (`X-Data-Version`). */
  forVersion(version: number): OutboxApi;
  createTag(
    name: string,
    clientId?: string,
    made?: string
  ): Promise<TagDocument>;
  keepTag(tagId: string, made?: string): Promise<TagDocument>;
  updateTag(tagId: string, name: string, made?: string): Promise<TagDocument>;
  setTagPublic(
    tagId: string,
    isPublic: boolean,
    made?: string
  ): Promise<TagDocument>;
  deleteTag(tagId: string, made?: string): Promise<TagDocument>;
  reorderTag(payload: TagReorderDocument, made?: string): Promise<void>;
  createEntry(
    subject: string,
    body: string,
    clientId?: string,
    made?: string
  ): Promise<TextEntryDocument>;
  updateEntry(
    entryId: string,
    subject: string,
    body: string,
    made?: string
  ): Promise<TextEntryDocument>;
  deleteEntry(entryId: string, made?: string): Promise<TextEntryDocument>;
  reuseEntry(
    entryId: string,
    clientId: string,
    made?: string
  ): Promise<TextEntryReusedDocument>;
  setEntryPublic(
    entryId: string,
    isPublic: boolean,
    made?: string
  ): Promise<TextEntryDocument>;
  tagEntry(
    tagId: string,
    entryId: string,
    made?: string
  ): Promise<TagTextEntryDocument>;
  untagEntry(junctionId: string, made?: string): Promise<TagTextEntryDocument>;
  reorderEntry(top: string, bottom: string, made?: string): Promise<void>;
  getTag(tagId: string): Promise<TagDocument>;
  getTagsAfter(after: string): Promise<TagCursorListDocument>;
  getTagJunctionsAfter(
    tagId: string,
    after: string
  ): Promise<TagTextEntryCursorListDocument>;
  getEntry(entryId: string): Promise<TextEntryDocument>;
  getEntryReuses(
    entryId: string | undefined,
    page: number
  ): Promise<TextEntryReusedListDocument>;
  getJunction(
    tagId: string,
    entryId: string
  ): Promise<TagTextEntryListDocument>;
}

/**
 * What a sent write brought back: rows to store, a create's new id, a row
 * the API no longer has (a restore's), which goes, and what is left to do.
 */
export interface Sent {
  resources: IncludedResource[];
  created?: {type: string; from: string; to: string};
  gone?: [string, string];
  /** The write that takes this one's place in the queue (a reorder's read). */
  next?: QueuedWrite;
}

/** A single document's rows: its `data`, then its `included`. */
export const answer = (document: {
  data: IncludedResource;
  included?: IncludedResource[] | undefined;
}): IncludedResource[] => [document.data, ...(document.included ?? [])];

type WriteOf<K extends QueuedWrite['kind']> = Extract<QueuedWrite, {kind: K}>;

type TagWrite = WriteOf<
  | 'createTag'
  | 'keepTag'
  | 'renameTag'
  | 'setTagPublic'
  | 'deleteTag'
  | 'reorderTags'
>;
type EntryWrite = WriteOf<
  | 'createEntry'
  | 'updateEntry'
  | 'setEntryPublic'
  | 'deleteEntry'
  | 'reuseEntry'
>;
type JunctionWrite = WriteOf<'tagEntry' | 'untagEntry' | 'reorderEntries'>;
type ReadWrite = WriteOf<
  | 'refreshTags'
  | 'refreshJunctions'
  | 'restoreTag'
  | 'restoreEntry'
  | 'restoreJunction'
>;

/** Send one queued write. */
export function send(
  api: OutboxApi,
  write: QueuedWrite,
  made: string
): Promise<Sent> {
  switch (write.kind) {
    case 'createTag':
    case 'keepTag':
    case 'renameTag':
    case 'setTagPublic':
    case 'deleteTag':
    case 'reorderTags':
      return sendTagWrite(api, write, made);
    case 'createEntry':
    case 'updateEntry':
    case 'setEntryPublic':
    case 'deleteEntry':
    case 'reuseEntry':
      return sendEntryWrite(api, write, made);
    case 'tagEntry':
    case 'untagEntry':
    case 'reorderEntries':
      return sendJunctionWrite(api, write, made);
    case 'refreshTags':
    case 'refreshJunctions':
    case 'restoreTag':
    case 'restoreEntry':
    case 'restoreJunction':
      return sendRead(api, write);
  }
}

async function sendTagWrite(
  api: OutboxApi,
  write: TagWrite,
  made: string
): Promise<Sent> {
  switch (write.kind) {
    case 'createTag': {
      const document = await api.createTag(write.name, write.tagId, made);
      return {
        resources: answer(document),
        created: {type: TAG, from: write.tagId, to: document.data.id},
      };
    }
    case 'keepTag':
      return {resources: answer(await api.keepTag(write.tagId, made))};
    case 'renameTag':
      return {
        resources: answer(await api.updateTag(write.tagId, write.name, made)),
      };
    case 'setTagPublic':
      return {
        resources: answer(
          await api.setTagPublic(write.tagId, write.isPublic, made)
        ),
      };
    case 'deleteTag':
      return {resources: answer(await api.deleteTag(write.tagId, made))};
    case 'reorderTags':
      await api.reorderTag(
        {
          data: {
            type: TAG,
            attributes: {top: write.top, bottom: write.bottom},
            relationships: {},
          },
        },
        made
      );
      // The answer is empty: the tags are read next (`refreshTags`).
      return {resources: [], next: {kind: 'refreshTags'}};
  }
}

async function sendEntryWrite(
  api: OutboxApi,
  write: EntryWrite,
  made: string
): Promise<Sent> {
  switch (write.kind) {
    case 'createEntry': {
      const document = await api.createEntry(
        write.subject,
        write.body,
        write.entryId,
        made
      );
      return {
        resources: answer(document),
        created: {type: TEXT_ENTRY, from: write.entryId, to: document.data.id},
      };
    }
    case 'updateEntry':
      return {
        resources: answer(
          await api.updateEntry(write.entryId, write.subject, write.body, made)
        ),
      };
    case 'setEntryPublic':
      return {
        resources: answer(
          await api.setEntryPublic(write.entryId, write.isPublic, made)
        ),
      };
    case 'deleteEntry':
      return {resources: answer(await api.deleteEntry(write.entryId, made))};
    case 'reuseEntry': {
      // The reuse itself is not stored: only the entry, as counted.
      const document = await api.reuseEntry(write.entryId, write.reuseId, made);
      return {resources: document.included ?? []};
    }
  }
}

async function sendJunctionWrite(
  api: OutboxApi,
  write: JunctionWrite,
  made: string
): Promise<Sent> {
  switch (write.kind) {
    case 'tagEntry': {
      const document = await api.tagEntry(write.tagId, write.entryId, made);
      return {
        resources: answer(document),
        created: {type: JUNCTION, from: write.junctionId, to: document.data.id},
      };
    }
    case 'untagEntry':
      return {
        resources: answer(await api.untagEntry(write.junctionId, made)),
      };
    case 'reorderEntries':
      await api.reorderEntry(write.top, write.bottom, made);
      return {
        resources: [],
        next: {kind: 'refreshJunctions', tagId: write.tagId},
      };
  }
}

async function sendRead(api: OutboxApi, write: ReadWrite): Promise<Sent> {
  switch (write.kind) {
    case 'refreshTags':
      // The tags the reorder ranked: the one moved (which a sync left as it
      // was while it was queued, and may not read again) and those it
      // shifted, so their ranks are the API's together.
      return {resources: await everyPage(after => api.getTagsAfter(after))};
    case 'refreshJunctions':
      // Likewise the tag's junctions.
      return {
        resources: await everyPage(after =>
          api.getTagJunctionsAfter(write.tagId, after)
        ),
      };
    case 'restoreTag':
      return restoring(TAG, write.tagId, async () =>
        answer(await api.getTag(write.tagId))
      );
    case 'restoreEntry':
      return restoring(TEXT_ENTRY, write.entryId, async () =>
        answer(await api.getEntry(write.entryId))
      );
    case 'restoreJunction':
      return restoring(JUNCTION, write.junctionId, async () => {
        const {data, included} = await api.getJunction(
          write.tagId,
          write.entryId
        );
        return [...data, ...(included ?? [])];
      });
  }
}

/** Every page of a keyset listing (`read` after a cursor), with `included`. */
async function everyPage(
  read: (after: string) => Promise<{
    data: Array<IncludedResource & {attributes: {date_updated: string}}>;
    included?: IncludedResource[] | undefined;
    links: {next: string | null};
  }>
): Promise<IncludedResource[]> {
  const resources: IncludedResource[] = [];
  for (let after = CURSOR_START; ; ) {
    const page = await read(after);
    resources.push(...page.data, ...(page.included ?? []));
    const last = page.data.at(-1);
    if (page.links.next === null || last === undefined) {
      return resources;
    }
    after = cursorOf(last);
  }
}

/** A restore's read: the row as the API holds it, or gone (a 404). */
async function restoring(
  type: string,
  id: string,
  read: () => Promise<IncludedResource[]>
): Promise<Sent> {
  try {
    return {resources: await read()};
  } catch (error: unknown) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return {resources: [], gone: [type, id]};
    }
    throw error;
  }
}
