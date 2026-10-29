/**
 * The mock API's state, as its database would hold it: the active data
 * version's rows, the other versions, the admin page's users and the ids
 * handed out. Other modules read the `let` bindings (live) and replace them
 * only through the setters here; `resetMSWState` starts it all afresh.
 */
import {
  CLIENT_WRITE_ID_HEADER,
  type Tag,
  type TagListDocument,
  type TagTextEntry,
  type TextEntryListDocument,
  type TextEntryReused,
} from '@commandsnippets/api-shared';

import {
  type EntriesState,
  type MockAdminUser,
  type MockAuditEntry,
  originalAdminUsers,
  originalEntriesResponse,
  originalTags,
} from './fixtures';

// Mutable copy for stateful operations
export let tags: TagListDocument['data'] = structuredClone(originalTags);
export const setTags = (next: TagListDocument['data']) => {
  tags = next;
};

// Mutable copy for stateful operations
export let entriesResponse: EntriesState = structuredClone(
  originalEntriesResponse
);
export const setEntriesResponse = (next: EntriesState) => {
  entriesResponse = next;
};

// Runtime override for test data - allows tests to inject custom responses
export let runtimeEntriesOverride: TextEntryListDocument | null = null;
export const dropEntriesOverride = () => {
  runtimeEntriesOverride = null;
};

// Deleted junctions: untagging soft-deletes (backend-v2 keeps the row, which
// the junction list shows). Kept apart from the entries' `included`, which
// holds only the junctions the entries have.
export let deletedJunctions: TagTextEntry[] = [];
export const setDeletedJunctions = (next: TagTextEntry[]) => {
  deletedJunctions = next;
};

/**
 * The reuses recorded (`POST /entry_reuses`), with the client ids they were
 * made with: a retried one is counted once, as the API counts it.
 */
export let reuses: Array<{reuse: TextEntryReused; clientId: string | null}> =
  [];
export const setReuses = (next: typeof reuses) => {
  reuses = next;
};

export let adminUsers: MockAdminUser[] = structuredClone(originalAdminUsers);

export let adminAuditLog: MockAuditEntry[] = [];

/**
 * The signed-in user's data versions, as the API keeps them: the handlers'
 * state is the active version's data, and every other version's is kept as
 * it was (`saved`) until it is made active again.
 */
export interface MockData {
  tags: Tag[];
  entries: EntriesState;
  deletedJunctions: TagTextEntry[];
}

export interface MockVersion {
  version: number;
  date_created: string;
  origin: 'initial' | 'restore';
  backup_username: string | null;
  backup_exported: string | null;
  /** Its data, while another version is active. */
  saved: MockData | null;
}

const initialVersions = (): MockVersion[] => [
  {
    version: 1,
    date_created: '2026-01-02T03:04:05.000000',
    origin: 'initial',
    backup_username: null,
    backup_exported: null,
    saved: null,
  },
];

export let versions = initialVersions();
export let activeVersion = 1;
export let lastVersion = 1;
export const setVersions = (next: MockVersion[]) => {
  versions = next;
};
export const setActiveVersion = (next: number) => {
  activeVersion = next;
};
export const setLastVersion = (next: number) => {
  lastVersion = next;
};

/**
 * The last id handed out, per resource. Like SQLite's AUTOINCREMENT, an id is
 * never handed out twice, even after the row that had the highest one is
 * deleted: a reused entry id would pick up the deleted entry's junctions.
 */
const lastIds = new Map<string, number>();

/** Deleting a row retires its id, so nextId never hands it out again. */
export function retireId(kind: string, id: string): void {
  lastIds.set(kind, Math.max(lastIds.get(kind) ?? 0, Number(id)));
}

export function nextId(
  kind: string,
  existing: ReadonlyArray<{id: string}>
): string {
  const next =
    Math.max(lastIds.get(kind) ?? 0, ...existing.map(({id}) => Number(id))) + 1;
  lastIds.set(kind, next);
  return String(next);
}

// The reorders made, by the id the client named each by: a retry is made
// once, as the API makes it.
const madeReorders = new Set<string>();

export const madeAlready = (request: Request) =>
  madeReorders.has(request.headers.get(CLIENT_WRITE_ID_HEADER) ?? '');

export const recordMade = (request: Request) => {
  const writeId = request.headers.get(CLIENT_WRITE_ID_HEADER);
  if (writeId !== null) {
    madeReorders.add(writeId);
  }
};

// The client ids of tag creates answered with a tag of the name the user had,
// by that id: a retry answers with that tag, as the API does.
export const tagsByClientId = new Map<string, string>();

// Public reads use the same owner models as admin reads, with filtered linkage.
export const publicGenerations = new Map<
  string,
  {fingerprint: string; revision: number}
>();

export const resetMSWState = () => {
  lastIds.clear();
  tagsByClientId.clear();
  madeReorders.clear();
  publicGenerations.clear();
  tags = structuredClone(originalTags);
  entriesResponse = structuredClone(originalEntriesResponse);
  runtimeEntriesOverride = null;
  deletedJunctions = [];
  reuses = [];
  adminUsers = structuredClone(originalAdminUsers);
  adminAuditLog = [];
  versions = initialVersions();
  activeVersion = 1;
  lastVersion = 1;
};

/** Replace the entries the handlers answer with (a test's runtime data). */
export const setRuntimeEntriesOverride = (
  override: TextEntryListDocument | null
) => {
  // A copy: the handlers write to it (tagging, editing).
  runtimeEntriesOverride = override === null ? null : structuredClone(override);
  // Deleted junctions were the replaced entries'.
  deletedJunctions = [];
};
