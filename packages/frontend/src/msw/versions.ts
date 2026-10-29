/**
 * The signed-in user's data versions: making one active, the version guard
 * on every request, backups and restores.
 */
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  CODES,
  DATA_VERSION_HEADER,
  type DataVersion,
  type RestoreResult,
  type Tag,
  type TextEntry,
} from '@commandsnippets/api-shared';
import invariant from 'invariant';
import {now} from './documents';
import {ownedByTestUser, testUser} from './fixtures';
import {apiError, errorResponse} from './requests';
import {SIGNED_IN_USER} from './route';
import {
  activeEntries,
  allJunctions,
  compare,
  createJunction,
  junctionsOf,
  nextEntryRevision,
  nextTagRevision,
  notFound,
} from './rows';
import {
  activeVersion,
  deletedJunctions,
  dropEntriesOverride,
  lastVersion,
  type MockData,
  type MockVersion,
  nextId,
  retireId,
  setActiveVersion,
  setDeletedJunctions,
  setEntriesResponse,
  setLastVersion,
  setTags,
  setVersions,
  tags,
  versions,
} from './state';

/** The active version's data: the handlers' state. */
export const currentData = (): MockData => ({
  tags,
  entries: activeEntries(),
  deletedJunctions,
});

/**
 * Keep the active version's data, and make version `version`'s the state.
 * Ids stay unique across versions, as the database's do.
 */
export function switchTo(version: MockVersion, data: MockData): void {
  const current = currentData();
  for (const tag of current.tags) retireId('Tag', tag.id);
  for (const entry of current.entries.data) retireId('TextEntry', entry.id);
  for (const junction of allJunctions(current.entries))
    retireId('TagTextEntryThroughModel', junction.id);
  const active = versions.find(({version: v}) => v === activeVersion);
  if (active !== undefined && active !== version) {
    active.saved = structuredClone(currentData());
  }
  setTags(data.tags);
  setEntriesResponse(data.entries);
  dropEntriesOverride();
  setDeletedJunctions(data.deletedJunctions);
  version.saved = null;
  setActiveVersion(version.version);
}

/** A version as the API renders it, with what its data holds. */
export function dataVersionResource(version: MockVersion): DataVersion {
  const data = version.saved ?? currentData();
  return {
    type: 'DataVersion',
    id: String(version.version),
    attributes: {
      version: version.version,
      date_created: version.date_created,
      active: version.version === activeVersion,
      origin: version.origin,
      backup_username: version.backup_username,
      backup_exported: version.backup_exported,
      tag_count: data.tags.filter(tag => !tag.attributes.is_deleted).length,
      entry_count: data.entries.data.filter(
        entry => !entry.attributes.is_deleted
      ).length,
    },
  };
}

/**
 * A request of the signed-in user's data naming another data version
 * (`X-Data-Version`) than the active one, or a write of it naming none,
 * refused as the API refuses them (409 `data_version_changed`, 400);
 * anything else goes on to the handlers.
 */
export function refuseAnotherVersion(request: Request) {
  const named = request.headers.get(DATA_VERSION_HEADER);
  const path = new URL(request.url).pathname;
  if (
    !/\/api\/v1\/(tags|entries|tags_entries|user\/backup|user\/restore|user\/analytics)\b/.test(
      path
    )
  ) {
    return undefined;
  }
  if (named === null) {
    return request.method === 'GET'
      ? undefined
      : errorResponse(
          apiError(
            400,
            CODES.invalid,
            `${DATA_VERSION_HEADER} must name the data version a write was made against.`
          )
        );
  }
  if (Number(named) === activeVersion) {
    return undefined;
  }
  return errorResponse(
    apiError(
      409,
      CODES.dataVersionChanged,
      'The data version changed. Sync the data again.'
    )
  );
}

/** The data version numbered `named`, or the API's 404. */
export function versionNamed(named: string): MockVersion {
  const version = versions.find(
    candidate => String(candidate.version) === named
  );
  if (version === undefined) {
    throw notFound('DataVersion');
  }
  return version;
}

/**
 * The signed-in user's backup of `data` (the active version's by default),
 * as the API makes it: what is not deleted, in the API's order, and only the
 * taggings of tags and entries it holds. The mock has no reuses.
 */
export function backupOf(data: MockData = currentData()): Backup {
  const byId = (a: {id: string}, b: {id: string}) =>
    Number(a.id) - Number(b.id);
  const liveTags = data.tags
    .filter(tag => !tag.attributes.is_deleted)
    .sort((a, b) => a.attributes.order - b.attributes.order || byId(a, b));
  const state = data.entries;
  const liveEntries = state.data
    .filter(entry => !entry.attributes.is_deleted)
    .sort(byId);
  const tagIds = new Set(liveTags.map(tag => tag.id));
  const entryIds = new Set(liveEntries.map(entry => entry.id));
  const taggings = junctionsOf(state)
    .filter(
      junction =>
        !junction.attributes.is_deleted &&
        tagIds.has(junction.relationships.tag.data.id) &&
        entryIds.has(junction.relationships.text_entry.data.id)
    )
    .sort(
      (a, b) =>
        Number(a.relationships.tag.data.id) -
          Number(b.relationships.tag.data.id) ||
        a.attributes.order - b.attributes.order ||
        byId(a, b)
    );
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    date_exported: now(),
    user: {id: testUser.id, username: SIGNED_IN_USER},
    tags: liveTags.map(({id, attributes}) => ({
      id,
      name: attributes.name,
      order: attributes.order,
      is_public: attributes.is_public,
      date_created: attributes.date_created,
      date_updated: attributes.date_updated,
    })),
    entries: liveEntries.map(({id, attributes}) => ({
      id,
      subject: attributes.subject,
      body: attributes.body,
      is_public: attributes.is_public,
      date_created: attributes.date_created,
      date_updated: attributes.date_updated,
    })),
    tags_entries: taggings.map(({id, attributes, relationships}) => ({
      id,
      tag_id: relationships.tag.data.id,
      text_entry_id: relationships.text_entry.data.id,
      order: attributes.order,
      date_created: attributes.date_created,
      date_updated: attributes.date_updated,
    })),
    entry_reuses: [],
  };
}

/**
 * Make `backup` the signed-in user's data, as the API does (`POST
 * /user/restore`): a new version, made active, of the backup's rows made
 * anew (new ids, the backup's order), with the counters the database's
 * triggers keep; the version before is kept as it was. The mock keeps no
 * reuses: they are only counted.
 */
export function restoreBackup(backup: Backup): RestoreResult {
  // Checked first, as the API does: a refused backup changes nothing.
  const tagIds = new Set(backup.tags.map(tag => tag.id));
  const entryIds = new Set(backup.entries.map(entry => entry.id));
  if (
    backup.tags_entries.some(
      row => !tagIds.has(row.tag_id) || !entryIds.has(row.text_entry_id)
    ) ||
    backup.entry_reuses.some(row => !entryIds.has(row.text_entry_id))
  ) {
    throw apiError(
      400,
      CODES.invalid,
      'Invalid backup: a row names a tag or entry it does not hold.'
    );
  }
  setLastVersion(lastVersion + 1);
  const version: MockVersion = {
    version: lastVersion,
    date_created: now(),
    origin: 'restore',
    backup_username: backup.user.username,
    backup_exported: backup.date_exported,
    saved: null,
  };
  setVersions([...versions, version]);
  switchTo(version, {tags: [], entries: {data: []}, deletedJunctions: []});

  const tagsMade = new Map<string, Tag>();
  const ordered = [...backup.tags].sort((a, b) => a.order - b.order);
  for (const [order, row] of ordered.entries()) {
    const tag: Tag = {
      type: 'Tag',
      id: nextId('Tag', tags),
      attributes: {
        name: row.name,
        order,
        is_public: row.is_public,
        is_deleted: false,
        date_created: row.date_created,
        date_last_used: row.date_created,
        date_updated: nextTagRevision(),
        entry_count: 0,
        client_id: null,
      },
      relationships: ownedByTestUser,
    };
    setTags([...tags, tag]);
    tagsMade.set(row.id, tag);
  }
  const state = activeEntries();
  const entriesMade = new Map<string, TextEntry>();
  for (const row of backup.entries) {
    const entry: TextEntry = {
      type: 'TextEntry',
      id: nextId('TextEntry', state.data),
      attributes: {
        subject: row.subject,
        body: row.body,
        date_created: row.date_created,
        date_updated: nextEntryRevision(state),
        is_public: row.is_public,
        reused_count: backup.entry_reuses.filter(
          reuse => reuse.text_entry_id === row.id
        ).length,
        is_deleted: false,
        tag_count: 0,
        client_id: null,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {data: [], meta: {count: 0}},
      },
    };
    state.data = [...state.data, entry];
    entriesMade.set(row.id, entry);
  }
  const taggings = [...backup.tags_entries].sort(
    (a, b) => Number(a.tag_id) - Number(b.tag_id) || a.order - b.order
  );
  for (const row of taggings) {
    const tag = tagsMade.get(row.tag_id);
    const entry = entriesMade.get(row.text_entry_id);
    invariant(tag && entry, 'the backup holds each tagging tag and entry');
    const junction = createJunction(state, tag, entry);
    junction.attributes = {
      ...junction.attributes,
      date_created: row.date_created,
    };
  }
  for (const tag of tagsMade.values()) {
    const newest = junctionsOf(state)
      .filter(junction => junction.relationships.tag.data.id === tag.id)
      .map(junction => junction.attributes.date_created)
      .sort(compare)
      .at(-1);
    tag.attributes = {
      ...tag.attributes,
      date_last_used: newest ?? tag.attributes.date_created,
    };
  }
  return {
    data_version: activeVersion,
    tags: backup.tags.length,
    entries: backup.entries.length,
    tags_entries: backup.tags_entries.length,
    entry_reuses: backup.entry_reuses.length,
  };
}
