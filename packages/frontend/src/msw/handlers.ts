import {
  type AdminAuditAction,
  type AdminAuditLogEntry,
  type AdminUser,
  adminUserUpdateAttributesSchema,
  BACKUP_FORMAT,
  BACKUP_VERSION,
  type Backup,
  backupSchema,
  CLIENT_WRITE_ID_HEADER,
  CODES,
  DATA_OWNER_ID_HEADER,
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
  type IncludedResource,
  MESSAGES,
  PUBLIC_REVISION_HEADER,
  parseDateTime,
  type RestoreResult,
  reorderAttributesSchema,
  type Tag,
  type TagCursorListDocument,
  type TagDocument,
  type TagListDocument,
  type TagTextEntry,
  type TagTextEntryCursorListDocument,
  type TagTextEntryDocument,
  type TagTextEntryListDocument,
  type TextEntry,
  type TextEntryCursorListDocument,
  type TextEntryDocument,
  type TextEntryListDocument,
  tagCreateAttributesSchema,
  tagTextEntryCreateRelationshipsSchema,
  tagUpdateAttributesSchema,
  textEntryCreateAttributesSchema,
  textEntryUpdateAttributesSchema,
  type User,
} from '@commandsnippets/api-shared';
import invariant from 'invariant';
import {HttpResponse, http} from 'msw';
import {
  errorDocument,
  nextRevision,
  now,
  onePage,
  pagination,
} from './documents';
import {afterOf, byRevision, keysetPage, positionOf} from './keyset';
import {recordRequest} from './requestCounter';
import {
  apiError,
  type ErrorObject,
  errorResponse,
  MockApiError,
  parseResource,
  relatedId,
  validateFields,
} from './requests';

// The responses follow the API contract (api-shared's document schemas);
// __tests__/src/msw/contract.spec.ts checks every one of them.

// The signed-in test user, as `included` holds it.
const testUser: User = {
  type: 'User',
  id: '1',
  attributes: {
    username: 'test',
    is_staff: true,
    date_updated: '2020-04-13T18:20:00',
    date_restored: null,
  },
};

const ownedByTestUser = {user: {data: {type: 'User', id: '1'}}} as const;

// Mock data for tags (matches test/mocks/tags/tagsResponse.ts)
// Keep original immutable for resets
const originalTags: TagListDocument['data'] = [
  {
    type: 'Tag',
    id: '1',
    attributes: {
      name: 'test-tag-1',
      is_public: false,
      entry_count: 2,
      order: 0,
      date_updated: '2020-05-07T18:20:00',
      date_created: '2020-05-07T18:20:00',
      date_last_used: '2020-05-07T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
  {
    type: 'Tag',
    id: '2',
    attributes: {
      name: 'test-tag-2',
      is_public: false,
      entry_count: 0,
      order: 1,
      date_updated: '2021-05-07T18:20:00',
      date_created: '2021-05-07T18:20:00',
      date_last_used: '2021-05-07T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
  {
    type: 'Tag',
    id: '3',
    attributes: {
      name: 'test-tag-3',
      is_public: false,
      entry_count: 0,
      order: 2,
      date_updated: '2022-05-07T18:20:00',
      date_created: '2022-05-07T18:20:00',
      date_last_used: '2022-05-07T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
  {
    type: 'Tag',
    id: '4',
    attributes: {
      name: 'test-tag-4',
      is_public: false,
      entry_count: 0,
      order: 3,
      date_updated: '2022-05-08T18:20:00',
      date_created: '2022-05-08T18:20:00',
      date_last_used: '2022-05-08T18:20:00',
      is_deleted: false,
    },
    relationships: ownedByTestUser,
  },
];

// Mutable copy for stateful operations
let tags: TagListDocument['data'] = structuredClone(originalTags);

// Original immutable entries for resets
const originalEntriesResponse: Pick<
  TextEntryListDocument,
  'data' | 'included'
> = {
  data: [
    {
      type: 'TextEntry',
      id: '1',
      attributes: {
        body: 'test entry 1',
        subject: 'test-entry-1-subject',
        date_updated: '2022-05-14T02:33:53.995003',
        date_created: '2022-05-14T02:33:53.994989',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: '1'}],
          meta: {count: 1},
        },
      },
    },
    {
      type: 'TextEntry',
      id: '2',
      attributes: {
        body: 'test entry 2',
        subject: 'test-entry-2-subject',
        date_updated: '2022-05-14T02:33:53.995003',
        date_created: '2022-05-14T02:33:53.994989',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: '2'}],
          meta: {count: 1},
        },
      },
    },
    {
      // In no tag: the untagged list's.
      type: 'TextEntry',
      id: '3',
      attributes: {
        body: 'test entry 3',
        subject: 'test-entry-3-subject',
        date_updated: '2022-05-14T02:33:53.995003',
        date_created: '2022-05-14T02:33:53.994989',
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 0,
      },
      relationships: {
        ...ownedByTestUser,
        text_entry_to_tag: {data: [], meta: {count: 0}},
      },
    },
  ],
  included: [
    {
      type: 'TagTextEntryThroughModel',
      id: '1',
      attributes: {
        order: 1,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '1'}},
        ...ownedByTestUser,
      },
    },
    {
      type: 'TagTextEntryThroughModel',
      id: '2',
      attributes: {
        order: 2,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
        is_deleted: false,
      },
      relationships: {
        tag: {data: {type: 'Tag', id: '1'}},
        text_entry: {data: {type: 'TextEntry', id: '2'}},
        ...ownedByTestUser,
      },
    },
    testUser,
  ],
};

type EntriesState = Pick<TextEntryListDocument, 'data' | 'included'>;

// Mutable copy for stateful operations
let entriesResponse: EntriesState = structuredClone(originalEntriesResponse);

// Runtime override for test data - allows tests to inject custom responses
let runtimeEntriesOverride: TextEntryListDocument | null = null;

// Deleted junctions: untagging soft-deletes (backend-v2 keeps the row, which
// the junction list shows). Kept apart from the entries' `included`, which
// holds only the junctions the entries have.
let deletedJunctions: TagTextEntry[] = [];

/**
 * The entries (with their junctions in `included`) that the handlers answer
 * with and write to: the runtime override when there is one.
 */
const activeEntries = (): EntriesState =>
  runtimeEntriesOverride ?? entriesResponse;

const isJunction = (resource: IncludedResource): resource is TagTextEntry =>
  resource.type === 'TagTextEntryThroughModel';

const junctionsOf = (state: EntriesState) =>
  (state.included ?? []).filter(isJunction);

/** `included` is left out when it would be empty. */
const setIncluded = (state: EntriesState, included: IncludedResource[]) => {
  if (included.length > 0) {
    state.included = included;
  } else {
    delete state.included;
  }
};

const compare = (a: string | number, b: string | number) =>
  a < b ? -1 : a > b ? 1 : 0;

/** The order the API renders `included` in: by type, then by id (as text). */
const byTypeAndId = (a: IncludedResource, b: IncludedResource) =>
  compare(a.type, b.type) || compare(a.id, b.id);

/** The resource of `resources` with `id`, or the API's 404 for `type`. */
function findOr404<R extends {id: string}>(
  resources: readonly R[],
  id: string,
  type: string
): R {
  const resource = resources.find(candidate => candidate.id === id);
  if (resource === undefined) {
    throw apiError(404, CODES.notFound, `No ${type} matches the given query.`);
  }
  return resource;
}

/**
 * Point `entry`'s `text_entry_to_tag` at its junctions, in the API's order
 * (by revision, then id).
 */
function linkJunctions(state: EntriesState, entry: TextEntry) {
  const data = junctionsOf(state)
    .filter(junction => junction.relationships.text_entry.data.id === entry.id)
    .sort(
      (a, b) =>
        compare(a.attributes.date_updated, b.attributes.date_updated) ||
        compare(Number(a.id), Number(b.id))
    )
    .map(({type, id}) => ({type, id}));
  entry.relationships = {
    ...entry.relationships,
    text_entry_to_tag: {data, meta: {count: data.length}},
  };
}

/**
 * A reorder's `top` and `bottom` among `rows`, as the API reads them: a pk
 * none of `rows` has is a 400 (`does_not_exist`).
 */
async function reorderPair<R extends {id: string}>(
  request: Request,
  type: 'Tag' | 'TagTextEntryThroughModel',
  rows: readonly R[]
): Promise<[R, R]> {
  const {attributes} = await parseResource(request, {type});
  const ids = validateFields(reorderAttributesSchema, attributes);
  const errors: ErrorObject[] = [];
  const [top, bottom] = (['top', 'bottom'] as const).map(name => {
    const id = String(ids[name]);
    const row = rows.find(candidate => candidate.id === id);
    if (row === undefined) {
      errors.push({
        detail: MESSAGES.pkDoesNotExist(id),
        status: '400',
        source: {pointer: `/data/attributes/${name}`},
        code: CODES.doesNotExist,
      });
    }
    return row;
  });
  if (top === undefined || bottom === undefined) {
    throw new MockApiError(400, errors);
  }
  return [top, bottom];
}

/**
 * Move `top` directly above `bottom` among `scope` (the rows ranked with
 * them), as the API does (django-ordered-model's `above`): the rows between
 * shift by one rank, and every row whose rank changes gets `revision`.
 */
function moveAbove<
  R extends {attributes: {order: number; date_updated: string}},
>(scope: readonly R[], top: R, bottom: R, revision: string): void {
  const from = top.attributes.order;
  const ranks = scope.map(row => row.attributes.order);
  const before = ranks.filter(rank => rank < bottom.attributes.order);
  const to =
    from < bottom.attributes.order
      ? before.length > 0
        ? Math.max(...before)
        : 0
      : bottom.attributes.order;
  if (from === bottom.attributes.order || from === to) {
    return;
  }
  for (const row of scope) {
    const rank = row.attributes.order;
    const order =
      row === top
        ? to
        : from < to && rank > from && rank <= to
          ? rank - 1
          : from > to && rank >= to && rank < from
            ? rank + 1
            : rank;
    if (order !== rank) {
      row.attributes = {...row.attributes, order, date_updated: revision};
    }
  }
}

/** The next revision of the tags. */
const nextTagRevision = () =>
  nextRevision(tags.map(tag => tag.attributes.date_updated));

/** Every junction, deleted ones too. */
const allJunctions = (state: EntriesState) => [
  ...junctionsOf(state),
  ...deletedJunctions,
];

/** The next revision of the junctions. */
const nextJunctionRevision = (state: EntriesState) =>
  nextRevision(
    allJunctions(state).map(junction => junction.attributes.date_updated)
  );

/**
 * Advance the revisions of `entry`'s junctions, as the database does whenever
 * the entry's revision advances (all to the same one), so the tags' junction
 * lists show the change.
 */
function touchJunctionsOf(state: EntriesState, entry: TextEntry) {
  const revision = nextJunctionRevision(state);
  for (const junction of junctionsOf(state)) {
    if (junction.relationships.text_entry.data.id === entry.id) {
      junction.attributes = {...junction.attributes, date_updated: revision};
    }
  }
}

/**
 * Advance the revisions of `entry`'s tags, as the database does whenever the
 * entry's revision advances (all to the same one).
 */
function touchTagsOf(state: EntriesState, entry: TextEntry) {
  const tagIds = new Set(
    junctionsOf(state)
      .filter(
        junction => junction.relationships.text_entry.data.id === entry.id
      )
      .map(junction => junction.relationships.tag.data.id)
  );
  const revision = nextTagRevision();
  for (const tag of tags) {
    if (tagIds.has(tag.id)) {
      tag.attributes = {...tag.attributes, date_updated: revision};
    }
  }
}

/**
 * Advance `entry`'s revision, as a write to its junctions does, and so its
 * tags' and junctions' revisions.
 */
function touchEntry(state: EntriesState, entry: TextEntry) {
  entry.attributes = {
    ...entry.attributes,
    date_updated: nextRevision(
      state.data.map(candidate => candidate.attributes.date_updated)
    ),
  };
  touchTagsOf(state, entry);
  touchJunctionsOf(state, entry);
}

/**
 * An entry's default `included`: its junctions, their tags and its owner
 * (`text_entry_to_tag`, `text_entry_to_tag.tag`, `user`).
 */
function entryIncluded(state: EntriesState, entry: TextEntry) {
  const junctions = junctionsOf(state).filter(
    junction => junction.relationships.text_entry.data.id === entry.id
  );
  const tagIds = new Set(
    junctions.map(junction => junction.relationships.tag.data.id)
  );
  const included: IncludedResource[] = [
    ...tags.filter(tag => tagIds.has(tag.id)),
    ...junctions,
    testUser,
  ];
  return included.sort(byTypeAndId);
}

/**
 * Tag `entry` with `tag`, as the API does: a junction at the bottom of the
 * tag (its highest rank + 1, or 0), restoring the pair's deleted one if there
 * is one, then its database triggers (the entry's `tag_count` and the tag's
 * `entry_count` go up, the tag is last used now and its revision advances)
 * and the entry's new revision (which advances its tags' and junctions'
 * revisions again).
 */
function createJunction(
  state: EntriesState,
  tag: Tag,
  entry: TextEntry
): TagTextEntry {
  const junctions = junctionsOf(state);
  const ranks = allJunctions(state)
    .filter(junction => junction.relationships.tag.data.id === tag.id)
    .map(junction => junction.attributes.order);
  const created = now();
  const deleted = deletedJunctions.find(
    candidate =>
      candidate.relationships.tag.data.id === tag.id &&
      candidate.relationships.text_entry.data.id === entry.id
  );
  deletedJunctions = deletedJunctions.filter(
    candidate => candidate !== deleted
  );
  const junction: TagTextEntry = {
    type: 'TagTextEntryThroughModel',
    id: deleted?.id ?? nextId('TagTextEntryThroughModel', junctions),
    attributes: {
      order: ranks.length > 0 ? Math.max(...ranks) + 1 : 0,
      date_updated: nextJunctionRevision(state),
      date_created: created,
      is_deleted: false,
    },
    relationships: {
      tag: {data: {type: 'Tag', id: tag.id}},
      text_entry: {data: {type: 'TextEntry', id: entry.id}},
      ...ownedByTestUser,
    },
  };
  setIncluded(state, [...(state.included ?? []), junction]);
  entry.attributes = {
    ...entry.attributes,
    tag_count: countJunctions(state, 'text_entry', entry.id),
  };
  tag.attributes = {
    ...tag.attributes,
    entry_count: countJunctions(state, 'tag', tag.id),
    date_last_used: created,
    date_updated: nextTagRevision(),
  };
  touchEntry(state, entry);
  linkJunctions(state, entry);
  return junction;
}

/**
 * A tag's `entry_count` or an entry's `tag_count`: the junctions there are,
 * as the database triggers keep them. Counted rather than stepped, so a
 * runtime override of the entries (whose junctions the tags' counts never
 * included) cannot take a count below zero.
 */
function countJunctions(
  state: EntriesState,
  side: 'tag' | 'text_entry',
  id: string
): number {
  return junctionsOf(state).filter(
    junction => junction.relationships[side].data.id === id
  ).length;
}

/**
 * Untag: soft-delete the junction (with a new revision), then its database
 * triggers (the counts go down, the tag was last used when its newest
 * remaining junction was made, and its revision advances) and the entry's new
 * revision (which advances the tags and junctions it is still in).
 */
function deleteJunction(state: EntriesState, junction: TagTextEntry) {
  retireId('TagTextEntryThroughModel', junction.id);
  deletedJunctions.push({
    ...junction,
    attributes: {
      ...junction.attributes,
      is_deleted: true,
      date_updated: nextJunctionRevision(state),
    },
  });
  setIncluded(
    state,
    (state.included ?? []).filter(resource => resource !== junction)
  );
  const entry = state.data.find(
    candidate => candidate.id === junction.relationships.text_entry.data.id
  );
  if (entry !== undefined) {
    entry.attributes = {
      ...entry.attributes,
      tag_count: countJunctions(state, 'text_entry', entry.id),
    };
    touchEntry(state, entry);
    linkJunctions(state, entry);
  }
  const tag = tags.find(
    candidate => candidate.id === junction.relationships.tag.data.id
  );
  if (tag !== undefined) {
    const remaining = junctionsOf(state)
      .filter(candidate => candidate.relationships.tag.data.id === tag.id)
      .map(candidate => candidate.attributes.date_created)
      .sort(compare);
    tag.attributes = {
      ...tag.attributes,
      entry_count: remaining.length,
      date_last_used: remaining.at(-1) ?? null,
      date_updated: nextTagRevision(),
    };
  }
}

/**
 * A user's data as the mocks hold it: the user, their tags, their entries
 * (with their junctions), and their deleted junctions.
 */
interface MockOwner {
  user: User;
  tags: readonly Tag[];
  state: EntriesState;
  deleted: readonly TagTextEntry[];
}

/** The signed-in test user's data (what the owner-only routes answer). */
const testOwner = (): MockOwner => ({
  user: testUser,
  tags,
  state: activeEntries(),
  deleted: deletedJunctions,
});

/**
 * The resources `include` adds to a page of `primary`, as the API renders
 * them: sorted by type, then by id; primary resources left out; the member
 * left out when empty. Each path walks from the primary resources:
 * `text_entry_to_tag` to an entry's junctions (not deleted), `tag` and
 * `text_entry` from a junction, `user` to the owner (the test user's data,
 * unless `owner` names another's).
 */
function includedFor(
  state: EntriesState,
  primary: ReadonlyArray<Tag | TextEntry | TagTextEntry>,
  paths: readonly string[],
  owner: Pick<MockOwner, 'user' | 'tags'> = testOwner()
): {included?: IncludedResource[]} {
  const found = new Map<string, IncludedResource>();
  const add = (resource: IncludedResource) =>
    found.set(`${resource.type}:${resource.id}`, resource);
  for (const path of paths) {
    let current: IncludedResource[] = [...primary];
    for (const segment of path.split('.')) {
      const next: IncludedResource[] = [];
      for (const resource of current) {
        if (segment === 'user') {
          next.push(owner.user);
        } else if (
          segment === 'text_entry_to_tag' &&
          resource.type === 'TextEntry'
        ) {
          next.push(
            ...junctionsOf(state).filter(
              junction =>
                junction.relationships.text_entry.data.id === resource.id
            )
          );
        } else if (
          segment === 'tag' &&
          resource.type === 'TagTextEntryThroughModel'
        ) {
          const tag = owner.tags.find(
            candidate => candidate.id === resource.relationships.tag.data.id
          );
          if (tag !== undefined) {
            next.push(tag);
          }
        } else if (
          segment === 'text_entry' &&
          resource.type === 'TagTextEntryThroughModel'
        ) {
          const entry = state.data.find(
            candidate =>
              candidate.id === resource.relationships.text_entry.data.id
          );
          if (entry !== undefined) {
            next.push(entry);
          }
        }
      }
      next.forEach(add);
      current = next;
    }
  }
  for (const resource of primary) {
    found.delete(`${resource.type}:${resource.id}`);
  }
  const included = [...found.values()].sort(byTypeAndId);
  return included.length > 0 ? {included} : {};
}

/** The request's `include` paths, or the resource's default ones. */
const includePaths = (url: URL, defaults: readonly string[]) => {
  const include = url.searchParams.get('include');
  return include === null
    ? defaults
    : include.split(',').filter(path => path !== '');
};

/** `filter[name]` as a boolean, when given. */
const booleanFilter = (url: URL, name: string) => {
  const value = url.searchParams.get(`filter[${name}]`);
  return value === null ? null : value === 'true' || value === '1';
};

/**
 * Whether `resource` passes `filter[date_updated.gt]`, when given: a revision
 * strictly newer (by the timestamp alone, as the API compares).
 */
const changedSince = (url: URL, resource: TagTextEntry | Tag | TextEntry) => {
  const since = url.searchParams.get('filter[date_updated.gt]');
  return (
    since === null ||
    positionOf(resource).dateUpdated > (parseDateTime(since) ?? since)
  );
};

// Alice's data (user 7), which staff read through the admin API: one tag
// with one entry. Staff change no one's data but their own, so it never
// changes.
const ALICE_DATE = '2026-09-01T00:00:00.000000';
const aliceUser: User = {
  type: 'User',
  id: '7',
  attributes: {
    username: 'alice',
    is_staff: false,
    date_updated: ALICE_DATE,
    date_restored: null,
  },
};
const aliceIs = {data: {type: 'User', id: '7'}} as const;
const aliceTags: Tag[] = [
  {
    type: 'Tag',
    id: '70',
    attributes: {
      name: 'alices-tag',
      date_created: ALICE_DATE,
      date_last_used: ALICE_DATE,
      date_updated: ALICE_DATE,
      is_public: false,
      entry_count: 1,
      order: 0,
      is_deleted: false,
    },
    relationships: {user: aliceIs},
  },
];
const aliceJunction: TagTextEntry = {
  type: 'TagTextEntryThroughModel',
  id: '700',
  attributes: {
    order: 0,
    date_created: ALICE_DATE,
    date_updated: ALICE_DATE,
    is_deleted: false,
  },
  relationships: {
    tag: {data: {type: 'Tag', id: '70'}},
    text_entry: {data: {type: 'TextEntry', id: '71'}},
    user: aliceIs,
  },
};
const aliceEntries: EntriesState = {
  data: [
    {
      type: 'TextEntry',
      id: '71',
      attributes: {
        subject: 'alices-entry',
        body: 'echo alice',
        date_created: ALICE_DATE,
        date_updated: ALICE_DATE,
        is_public: false,
        reused_count: 0,
        is_deleted: false,
        tag_count: 1,
      },
      relationships: {
        user: aliceIs,
        text_entry_to_tag: {
          data: [{type: 'TagTextEntryThroughModel', id: '700'}],
          meta: {count: 1},
        },
      },
    },
  ],
  included: [aliceJunction],
};

/**
 * The data of admin user `id` (`/admin/users/:id/...`): the test user's, or
 * alice's; the API's 404 for anyone else.
 */
function adminDataOf(id: string): MockOwner {
  if (id === '1') {
    return testOwner();
  }
  if (id === '7') {
    return {user: aliceUser, tags: aliceTags, state: aliceEntries, deleted: []};
  }
  throw apiError(404, CODES.notFound, 'No AdminUser matches the given query.');
}

// Public reads use the same owner models as admin reads, with filtered linkage.
const publicGenerations = new Map<
  string,
  {fingerprint: string; revision: number}
>();
function publicOwner(username: string): {owner: MockOwner; revision: number} {
  const source =
    username === 'test'
      ? adminDataOf('1')
      : username === 'alice'
        ? adminDataOf('7')
        : adminDataOf('missing');
  const fingerprint = JSON.stringify([
    source.tags,
    source.state,
    source.deleted,
  ]);
  const held = publicGenerations.get(username);
  const revision =
    held === undefined
      ? 0
      : held.revision + (held.fingerprint === fingerprint ? 0 : 1);
  publicGenerations.set(username, {fingerprint, revision});
  const tags = source.tags.filter(
    tag => tag.attributes.is_public && !tag.attributes.is_deleted
  );
  const tagIds = new Set(tags.map(tag => tag.id));
  const entries = source.state.data.filter(
    entry => entry.attributes.is_public && !entry.attributes.is_deleted
  );
  const entryIds = new Set(entries.map(entry => entry.id));
  const junctions = junctionsOf(source.state).filter(
    j =>
      !j.attributes.is_deleted &&
      tagIds.has(j.relationships.tag.data.id) &&
      entryIds.has(j.relationships.text_entry.data.id)
  );
  const visibleEntries = entries
    .filter(entry =>
      junctions.some(j => j.relationships.text_entry.data.id === entry.id)
    )
    .map(entry => {
      const links = junctions.filter(
        j => j.relationships.text_entry.data.id === entry.id
      );
      return {
        ...entry,
        attributes: {
          ...entry.attributes,
          reused_count: 0,
          client_id: null,
          tag_count: links.length,
        },
        relationships: {
          ...entry.relationships,
          text_entry_to_tag: {
            data: links.map(j => ({type: j.type, id: j.id})),
            meta: {count: links.length},
          },
        },
      };
    });
  const publicTags = tags.map(tag => ({
    ...tag,
    attributes: {
      ...tag.attributes,
      client_id: null,
      date_last_used:
        junctions
          .filter(j => j.relationships.tag.data.id === tag.id)
          .map(j => j.attributes.date_created)
          .sort()
          .at(-1) ?? null,
      entry_count: junctions.filter(j => j.relationships.tag.data.id === tag.id)
        .length,
    },
  }));
  const owner: MockOwner = {
    user: {
      ...source.user,
      attributes: {...source.user.attributes, is_staff: false},
    },
    tags: publicTags,
    state: {data: visibleEntries, included: junctions},
    deleted: [],
  };
  return {owner, revision};
}

function publicResponse(
  request: Request,
  username: string,
  collection?: string
): Response {
  recordRequest('GET', request.url);
  try {
    const {owner, revision} = publicOwner(username);
    const expected = request.headers.get(PUBLIC_REVISION_HEADER);
    const expectedOwner = request.headers.get(DATA_OWNER_ID_HEADER);
    if (
      (expected !== null && expected !== String(revision)) ||
      (expectedOwner !== null && expectedOwner !== owner.user.id)
    )
      throw apiError(409, CODES.viewChanged, 'The public view changed.');
    if (collection === undefined)
      return HttpResponse.json({
        data: {
          type: 'DataOwner',
          id: owner.user.id,
          attributes: {username, access: 'public', public_revision: revision},
        },
      });
    const url = new URL(request.url);
    const tagId = url.searchParams.get('filter[tag.id]');
    const rows: readonly (Tag | TextEntry | TagTextEntry)[] =
      collection === 'tags'
        ? owner.tags
        : collection === 'entries'
          ? owner.state.data
          : junctionsOf(owner.state).filter(
              j => tagId === null || j.relationships.tag.data.id === tagId
            );
    const paths = includePaths(
      url,
      collection === 'tags'
        ? ['user']
        : collection === 'entries'
          ? ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user']
          : ['user', 'tag', 'text_entry']
    );
    const after = afterOf(url);
    if (after !== null) {
      const {data, links} = keysetPage(url, rows, after);
      return HttpResponse.json({
        data,
        links,
        ...includedFor(owner.state, data, paths, owner),
      });
    }
    const sorted = [...rows].sort(byRevision);
    if (url.searchParams.get('sort') === '-date_updated') sorted.reverse();
    const size = Math.min(
      Number(url.searchParams.get('page[size]') ?? 50) || 50,
      100
    );
    return HttpResponse.json({
      ...onePage(request.url, sorted.length),
      data: sorted.slice(0, size),
      ...includedFor(owner.state, sorted.slice(0, size), paths, owner),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// The reorders made, by the id the client named each by: a retry is made
// once, as the API makes it.
const madeReorders = new Set<string>();
const madeAlready = (request: Request) =>
  madeReorders.has(request.headers.get(CLIENT_WRITE_ID_HEADER) ?? '');
const recordMade = (request: Request) => {
  const writeId = request.headers.get(CLIENT_WRITE_ID_HEADER);
  if (writeId !== null) {
    madeReorders.add(writeId);
  }
};

// The client ids of tag creates answered with a tag of the name the user had,
// by that id: a retry answers with that tag, as the API does.
const tagsByClientId = new Map<string, string>();

// Admin page data: the signed-in test user (id 1, staff) and one other.
interface MockAdminUser {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
  date_marked_for_deletion: string | null;
}
interface MockAuditEntry {
  id: string;
  created: string;
  action: AdminAuditAction;
  target: string;
}
const originalAdminUsers: MockAdminUser[] = [
  {
    id: '1',
    username: 'test',
    email: 'test@example.com',
    is_staff: true,
    is_active: true,
    date_marked_for_deletion: null,
  },
  {
    id: '7',
    username: 'alice',
    email: 'alice@example.com',
    is_staff: false,
    is_active: true,
    date_marked_for_deletion: null,
  },
];
let adminUsers: MockAdminUser[] = structuredClone(originalAdminUsers);
let adminAuditLog: MockAuditEntry[] = [];

const adminUserResource = (user: MockAdminUser): AdminUser => ({
  type: 'AdminUser',
  id: user.id,
  attributes: {
    username: user.username,
    email: user.email,
    first_name: '',
    last_name: '',
    is_staff: user.is_staff,
    is_active: user.is_active,
    date_joined: '2026-01-02T03:04:05.000000',
    last_login: '2026-09-01T00:00:00.000000',
    last_active: '2026-09-02T00:00:00.000000',
    login_count: 4,
    date_updated: '2026-09-01T00:00:00.000000',
    date_marked_for_deletion: user.date_marked_for_deletion,
    entry_count: 12,
    tag_count: 3,
  },
});

const adminAuditLogResource = (entry: MockAuditEntry): AdminAuditLogEntry => ({
  type: 'AdminAuditLogEntry',
  id: entry.id,
  attributes: {
    created: entry.created,
    action: entry.action,
    actor_id: '1',
    actor_username: 'test',
    target_user_id: null,
    target_username: entry.target,
  },
});

/** A one-page list document of `data`, for the request to `url`. */
const listDocument = <T>(url: string, data: T[]) => ({
  ...onePage(url, data.length),
  data,
});

const apiBaseUrls = [
  'http://localhost:9001/api/v1',
  'https://api-staging.commandsnippets.com/api/v1',
  'https://api.commandsnippets.com/api/v1',
] as const;

/** The user the mock API is signed in as (what `/user/` answers). */
const SIGNED_IN_USER = 'test';

/**
 * A request naming another user than the signed-in one, refused as the API
 * refuses it (409 `user_mismatch`); anything else goes on to the handlers.
 */
function refuseAnotherUsersRequest(request: Request) {
  const expected = request.headers.get(EXPECTED_USER_HEADER);
  const expectedId = request.headers.get(EXPECTED_USER_ID_HEADER);
  if (
    (expected === null || decodeURIComponent(expected) === SIGNED_IN_USER) &&
    (expectedId === null || expectedId === testUser.id)
  ) {
    return undefined;
  }
  return HttpResponse.json(
    {
      errors: [
        {
          detail: 'The request is not signed in as the user it names.',
          status: '409',
          source: {pointer: '/data'},
          code: CODES.userMismatch,
        },
      ],
    },
    {status: 409}
  );
}

/**
 * The signed-in user's backup, as the API makes it: what is not deleted, in
 * the API's order, and only the taggings of tags and entries it holds. The
 * mock has no reuses.
 */
function backupOf(): Backup {
  const byId = (a: {id: string}, b: {id: string}) =>
    Number(a.id) - Number(b.id);
  const liveTags = tags
    .filter(tag => !tag.attributes.is_deleted)
    .sort((a, b) => a.attributes.order - b.attributes.order || byId(a, b));
  const state = activeEntries();
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
 * Replace the signed-in user's data with `backup`'s, as the API does
 * (`POST /user/restore`): every junction, entry and tag soft-deleted (with
 * new revisions), then the backup's made anew, ranked after the user's (a
 * tag of a name the user has brought back in place), with the counters the
 * database's triggers keep. The mock keeps no reuses: they are only counted.
 */
/** When the mock user's data was last restored (`date_restored`), if ever. */
let restoredAt: string | null = null;

function restoreBackup(backup: Backup): RestoreResult {
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
  const state = activeEntries();
  for (const junction of junctionsOf(state)) {
    deleteJunction(state, junction);
  }
  const deletedAt = nextRevision(
    state.data.map(entry => entry.attributes.date_updated)
  );
  for (const entry of state.data) {
    if (!entry.attributes.is_deleted) {
      entry.attributes = {
        ...entry.attributes,
        is_deleted: true,
        date_updated: deletedAt,
      };
    }
  }
  const tagsDeletedAt = nextTagRevision();
  for (const tag of tags) {
    if (!tag.attributes.is_deleted) {
      tag.attributes = {
        ...tag.attributes,
        is_deleted: true,
        date_updated: tagsDeletedAt,
      };
    }
  }

  const tagsMade = new Map<string, Tag>();
  for (const row of [...backup.tags].sort((a, b) => a.order - b.order)) {
    const attributes = {
      name: row.name,
      order: Math.max(-1, ...tags.map(other => other.attributes.order)) + 1,
      is_public: row.is_public,
      is_deleted: false,
      date_created: row.date_created,
      date_last_used: row.date_created,
      date_updated: nextTagRevision(),
    };
    let tag = tags.find(other => other.attributes.name === row.name);
    if (tag === undefined) {
      tag = {
        type: 'Tag',
        id: nextId('Tag', tags),
        attributes: {...attributes, entry_count: 0, client_id: null},
        relationships: ownedByTestUser,
      };
      tags = [...tags, tag];
    } else {
      tag.attributes = {...tag.attributes, ...attributes};
    }
    tagsMade.set(row.id, tag);
  }

  const entriesMade = new Map<string, TextEntry>();
  for (const row of backup.entries) {
    const entry: TextEntry = {
      type: 'TextEntry',
      id: nextId('TextEntry', state.data),
      attributes: {
        subject: row.subject,
        body: row.body,
        date_created: row.date_created,
        date_updated: nextRevision(
          state.data.map(candidate => candidate.attributes.date_updated)
        ),
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
  restoredAt = now();
  return {
    date_restored: restoredAt,
    tags: backup.tags.length,
    entries: backup.entries.length,
    tags_entries: backup.tags_entries.length,
    entry_reuses: backup.entry_reuses.length,
  };
}

// Create handlers for all URLs
const createHandlers = () => {
  const handlers = [];

  for (const baseUrl of apiBaseUrls) {
    handlers.push(
      http.all(`${baseUrl}/*`, ({request}) =>
        refuseAnotherUsersRequest(request)
      ),
      // The signed-in user (read by the admin page)
      http.get(`${baseUrl}/user/`, ({request}) => {
        recordRequest('GET', request.url);
        return HttpResponse.json({
          data: {
            type: 'User',
            id: '1',
            attributes: {
              username: SIGNED_IN_USER,
              is_staff: true,
              date_updated: '2026-09-01T00:00:00.000000',
              date_restored: restoredAt,
            },
          },
        });
      }),

      http.get(`${baseUrl}/user/backup`, ({request}) => {
        recordRequest('GET', request.url);
        return HttpResponse.json(backupOf(), {
          headers: {'Cache-Control': 'no-store'},
        });
      }),
      http.post(`${baseUrl}/user/restore`, async ({request}) => {
        recordRequest('POST', request.url);
        try {
          const body: unknown = await request.json().catch(() => undefined);
          const parsed = backupSchema.safeParse(body);
          if (!parsed.success) {
            const [issue] = parsed.error.issues;
            const pointer = `/${(issue?.path ?? []).map(String).join('/')}`;
            throw apiError(
              400,
              CODES.invalid,
              `Invalid backup at ${pointer}: ${issue?.message ?? 'invalid'}`
            );
          }
          return HttpResponse.json(restoreBackup(parsed.data), {
            headers: {'Cache-Control': 'no-store'},
          });
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Admin API
      http.get(`${baseUrl}/users/:username`, ({request, params}) =>
        publicResponse(request, String(params['username']))
      ),
      http.get(`${baseUrl}/users/:username/tags`, ({request, params}) =>
        publicResponse(request, String(params['username']), 'tags')
      ),
      http.get(`${baseUrl}/users/:username/entries`, ({request, params}) =>
        publicResponse(request, String(params['username']), 'entries')
      ),
      http.get(`${baseUrl}/users/:username/tags_entries`, ({request, params}) =>
        publicResponse(request, String(params['username']), 'tags_entries')
      ),
      http.get(`${baseUrl}/admin/users`, ({request}) => {
        recordRequest('GET', request.url);
        const params = new URL(request.url).searchParams;
        const search = params.get('filter[search]')?.toLowerCase();
        const active = params.get('filter[is_active]');
        const username = params.get('filter[username]');
        const matching = adminUsers.filter(
          user =>
            (search === undefined ||
              user.username.includes(search) ||
              user.email.includes(search)) &&
            (active === null || String(user.is_active) === active) &&
            (username === null || user.username === username)
        );
        return HttpResponse.json(
          listDocument(request.url, matching.map(adminUserResource))
        );
      }),
      // A user's data, read-only, as the admin API renders it: the same
      // pages as the owner-only lists (the sync's keyset reads, and the
      // newest junction).
      http.get(`${baseUrl}/admin/users/:id/tags`, ({params, request}) => {
        recordRequest('GET', request.url);
        try {
          const owner = adminDataOf(String(params['id']));
          const url = new URL(request.url);
          const rows = owner.tags.filter(tag => changedSince(url, tag));
          const paths = includePaths(url, ['user']);
          const after = afterOf(url);
          if (after !== null) {
            const {data, links} = keysetPage(url, rows, after);
            const body: TagCursorListDocument = {
              links,
              data,
              ...includedFor(owner.state, data, paths, owner),
            };
            return HttpResponse.json(body);
          }
          const body: TagListDocument = {
            ...listDocument(request.url, rows),
            ...includedFor(owner.state, rows, paths, owner),
          };
          return HttpResponse.json(body);
        } catch (error) {
          return errorResponse(error);
        }
      }),
      http.get(`${baseUrl}/admin/users/:id/entries`, ({params, request}) => {
        recordRequest('GET', request.url);
        try {
          const owner = adminDataOf(String(params['id']));
          const url = new URL(request.url);
          const rows = owner.state.data.filter(entry =>
            changedSince(url, entry)
          );
          const paths = includePaths(url, [
            'text_entry_to_tag',
            'text_entry_to_tag.tag',
            'user',
          ]);
          const after = afterOf(url);
          if (after !== null) {
            const {data, links} = keysetPage(url, rows, after);
            const body: TextEntryCursorListDocument = {
              links,
              data,
              ...includedFor(owner.state, data, paths, owner),
            };
            return HttpResponse.json(body);
          }
          const body: TextEntryListDocument = {
            ...listDocument(request.url, rows),
            ...includedFor(owner.state, rows, paths, owner),
          };
          return HttpResponse.json(body);
        } catch (error) {
          return errorResponse(error);
        }
      }),
      http.get(
        `${baseUrl}/admin/users/:id/tags_entries`,
        ({params, request}) => {
          recordRequest('GET', request.url);
          try {
            const owner = adminDataOf(String(params['id']));
            const url = new URL(request.url);
            const tagId = url.searchParams.get('filter[tag.id]');
            const rows = [...junctionsOf(owner.state), ...owner.deleted].filter(
              junction =>
                changedSince(url, junction) &&
                (tagId === null || junction.relationships.tag.data.id === tagId)
            );
            const paths = includePaths(url, ['user', 'tag', 'text_entry']);
            const after = afterOf(url);
            if (after !== null) {
              const {data, links} = keysetPage(url, rows, after);
              const body: TagTextEntryCursorListDocument = {
                links,
                data,
                ...includedFor(owner.state, data, paths, owner),
              };
              return HttpResponse.json(body);
            }
            const sorted = [...rows].sort(byRevision);
            if (url.searchParams.get('sort') === '-date_updated') {
              sorted.reverse();
            }
            const size = Math.min(
              Number(url.searchParams.get('page[size]') ?? 50) || 50,
              100
            );
            const data = sorted.slice(0, size);
            const body: TagTextEntryListDocument = {
              ...pagination(
                request.url,
                1,
                Math.max(1, Math.ceil(sorted.length / size)),
                sorted.length
              ),
              data,
              ...includedFor(owner.state, data, paths, owner),
            };
            return HttpResponse.json(body);
          } catch (error) {
            return errorResponse(error);
          }
        }
      ),
      // Deactivate, reactivate, or (un)mark for deletion, as the API does
      // (marking deactivates too); staff cannot do either to themselves.
      http.patch(`${baseUrl}/admin/users/:id`, async ({params, request}) => {
        recordRequest('PATCH', request.url);
        try {
          const user = findOr404(adminUsers, String(params['id']), 'AdminUser');
          const {attributes} = await parseResource(request, {
            type: 'AdminUser',
            id: user.id,
          });
          const changes = validateFields(
            adminUserUpdateAttributesSchema,
            attributes
          );
          const wasMarked = user.date_marked_for_deletion !== null;
          const marked = changes.marked_for_deletion ?? wasMarked;
          if (marked && changes.is_active === true) {
            throw apiError(
              400,
              CODES.invalid,
              'An account marked for deletion cannot be reactivated.',
              '/data/attributes/is_active'
            );
          }
          const active = marked ? false : (changes.is_active ?? user.is_active);
          const marking = marked && !wasMarked;
          if (user.username === SIGNED_IN_USER && marking) {
            throw apiError(
              400,
              CODES.invalid,
              'You cannot mark your own account for deletion.',
              '/data/attributes/marked_for_deletion'
            );
          }
          if (user.username === SIGNED_IN_USER && !active && user.is_active) {
            throw apiError(
              400,
              CODES.invalid,
              'You cannot deactivate your own account.',
              '/data/attributes/is_active'
            );
          }
          const record = (action: AdminAuditAction) =>
            adminAuditLog.unshift({
              id: String(adminAuditLog.length + 1),
              created: '2026-09-28T12:00:00.000000',
              action,
              target: user.username,
            });
          if (marked !== wasMarked) {
            record(
              marked ? 'mark_user_for_deletion' : 'unmark_user_for_deletion'
            );
          }
          if (active !== user.is_active && !marking) {
            record(active ? 'activate_user' : 'deactivate_user');
          }
          user.is_active = active;
          user.date_marked_for_deletion = marked
            ? (user.date_marked_for_deletion ?? '2026-09-28T12:00:00.000000')
            : null;
          return HttpResponse.json({data: adminUserResource(user)});
        } catch (error) {
          return errorResponse(error);
        }
      }),
      http.get(`${baseUrl}/admin/audit_log`, ({request}) => {
        recordRequest('GET', request.url);
        return HttpResponse.json(
          listDocument(request.url, adminAuditLog.map(adminAuditLogResource))
        );
      }),

      // Health check endpoint
      http.get(`${baseUrl}/health`, ({request}) => {
        recordRequest('GET', request.url);
        console.log('OK: MSW intercepted health check request');
        return HttpResponse.json(
          {status: 'ok'},
          {
            status: 200,
          }
        );
      }),

      // Tags endpoint (with optional query parameters)
      http.get(`${baseUrl}/tags`, req => {
        recordRequest('GET', req.request.url);
        console.log('OK: MSW intercepted tags request:', req.request.url);
        const url = new URL(req.request.url);
        try {
          // A keyset page, as the API renders it (the sync's reads).
          const after = afterOf(url);
          if (after !== null) {
            const {data, links} = keysetPage(
              url,
              tags.filter(tag => changedSince(url, tag)),
              after
            );
            const body: TagCursorListDocument = {
              links,
              data,
              ...includedFor(
                activeEntries(),
                data,
                includePaths(url, ['user'])
              ),
            };
            return HttpResponse.json(body, {status: 200});
          }
        } catch (error) {
          return errorResponse(error);
        }
        const tagsResponse: TagListDocument = {
          ...listDocument(req.request.url, tags),
          included: [testUser],
        };
        return HttpResponse.json(tagsResponse, {
          status: 200,
        });
      }),

      // Create a tag, or answer with the user's of that name (bringing back
      // a deleted one), always 201, as the API does; a create naming a
      // client id a tag has answers with that tag, whatever it is called now
      http.post(`${baseUrl}/tags`, async ({request}) => {
        recordRequest('POST', request.url);
        console.log('OK: MSW intercepted tags POST request');
        try {
          const {attributes} = await parseResource(request, {type: 'Tag'});
          const {name, client_id: clientId} = validateFields(
            tagCreateAttributesSchema,
            attributes
          );
          const answered =
            clientId === undefined ? undefined : tagsByClientId.get(clientId);
          const made =
            clientId === undefined
              ? undefined
              : tags.find(
                  candidate =>
                    candidate.attributes.client_id === clientId ||
                    candidate.id === answered
                );
          if (made !== undefined) {
            const again: TagDocument = {data: made, included: [testUser]};
            return HttpResponse.json(again, {status: 201});
          }
          let tag = tags.find(candidate => candidate.attributes.name === name);
          if (tag !== undefined && clientId !== undefined) {
            tagsByClientId.set(clientId, tag.id);
          }
          if (tag === undefined) {
            const created = now();
            tag = {
              type: 'Tag',
              id: nextId('Tag', tags),
              attributes: {
                name,
                date_updated: nextTagRevision(),
                date_created: created,
                date_last_used: created,
                is_deleted: false,
                is_public: false,
                entry_count: 0,
                order:
                  Math.max(-1, ...tags.map(other => other.attributes.order)) +
                  1,
                client_id: clientId ?? null,
              },
              relationships: ownedByTestUser,
            };
            tags = [...tags, tag];
          } else if (tag.attributes.is_deleted) {
            tag.attributes = {
              ...tag.attributes,
              is_deleted: false,
              date_updated: nextTagRevision(),
            };
          }
          const body: TagDocument = {data: tag, included: [testUser]};
          return HttpResponse.json(body, {status: 201});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // One tag, or one entry (deleted ones too)
      http.get(`${baseUrl}/tags/:id`, ({params, request}) => {
        recordRequest('GET', request.url);
        try {
          const tag = findOr404(tags, String(params['id']), 'Tag');
          const body: TagDocument = {data: tag, included: [testUser]};
          return HttpResponse.json(body);
        } catch (error) {
          return errorResponse(error);
        }
      }),
      http.get(`${baseUrl}/entries/:id`, ({params, request}) => {
        recordRequest('GET', request.url);
        try {
          const state = activeEntries();
          const entry = findOr404(
            state.data,
            String(params['id']),
            'TextEntry'
          );
          const body: TextEntryDocument = {
            data: entry,
            ...includedFor(
              state,
              [entry],
              ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user']
            ),
          };
          return HttpResponse.json(body);
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Rename or (un)delete a tag: the attributes sent, and a new revision
      http.patch(`${baseUrl}/tags/:id`, async ({params, request}) => {
        recordRequest('PATCH', request.url);
        console.log('OK: MSW intercepted tag PATCH request:', request.url);
        try {
          const tag = findOr404(tags, String(params['id']), 'Tag');
          const {attributes} = await parseResource(request, {
            type: 'Tag',
            id: tag.id,
          });
          const changes = validateFields(tagUpdateAttributesSchema, attributes);
          // A user's tags have unique names, the deleted ones' included.
          if (
            tags.some(
              other =>
                other.id !== tag.id && other.attributes.name === changes.name
            )
          ) {
            throw apiError(
              400,
              CODES.unique,
              'The fields name, user must make a unique set.'
            );
          }
          tag.attributes = {
            ...tag.attributes,
            ...(changes.name === undefined ? {} : {name: changes.name}),
            ...(changes.is_public === undefined
              ? {}
              : {is_public: changes.is_public}),
            ...(changes.is_deleted === undefined
              ? {}
              : {is_deleted: changes.is_deleted}),
            date_updated: nextRevision(
              tags.map(candidate => candidate.attributes.date_updated)
            ),
          };
          const body: TagDocument = {data: tag, included: [testUser]};
          return HttpResponse.json(body, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Entries endpoint (with optional query parameters)
      http.get(`${baseUrl}/entries`, req => {
        recordRequest('GET', req.request.url);

        try {
          // A keyset page, as the API renders it (the sync's reads): deleted
          // entries too, filtered by tag, deletion and revision.
          const url = new URL(req.request.url);
          const after = afterOf(url);
          if (after !== null) {
            const state = activeEntries();
            const tagId = url.searchParams.get('filter[tags.id]');
            const deleted = booleanFilter(url, 'is_deleted');
            const rows = state.data.filter(
              entry =>
                changedSince(url, entry) &&
                (deleted === null || entry.attributes.is_deleted === deleted) &&
                (tagId === null ||
                  junctionsOf(state).some(
                    junction =>
                      junction.relationships.text_entry.data.id === entry.id &&
                      junction.relationships.tag.data.id === tagId
                  ))
            );
            const {data, links} = keysetPage(url, rows, after);
            const body: TextEntryCursorListDocument = {
              links,
              data,
              ...includedFor(
                state,
                data,
                includePaths(url, [
                  'text_entry_to_tag',
                  'text_entry_to_tag.tag',
                  'user',
                ])
              ),
            };
            return HttpResponse.json(body, {status: 200});
          }
        } catch (error) {
          return errorResponse(error);
        }

        // Use runtime override if available, otherwise use default entries
        let responseData: Pick<TextEntryListDocument, 'data' | 'included'> =
          runtimeEntriesOverride || entriesResponse;

        // Handle date filtering if specified
        const url = new URL(req.request.url);
        const dateFilter = url.searchParams.get('filter[date_updated.gt]');

        if (dateFilter && runtimeEntriesOverride) {
          const filterDate = new Date(dateFilter);
          const filteredEntries = responseData.data.filter(entry => {
            const entryDate = new Date(entry.attributes.date_updated);
            return entryDate > filterDate;
          });

          // Create filtered response with only newer entries and related through models
          const entryIds = filteredEntries.map(entry => entry.id);
          const included = runtimeEntriesOverride.included ?? [];
          const filteredThroughModels = included.filter(
            item =>
              item.type === 'TagTextEntryThroughModel' &&
              entryIds.includes(item.relationships.text_entry.data.id)
          );
          const otherIncluded = included.filter(
            item => item.type !== 'TagTextEntryThroughModel'
          );
          const filteredIncluded = [...filteredThroughModels, ...otherIncluded];

          responseData = {
            data: filteredEntries,
            // `included` is left out when it would be empty.
            ...(filteredIncluded.length > 0
              ? {included: filteredIncluded}
              : {}),
          };
        }

        const body: TextEntryListDocument = {
          ...onePage(req.request.url, responseData.data.length),
          ...responseData,
        };
        return HttpResponse.json(body, {
          status: 200,
        });
      }),

      // Create an entry from the attributes sent (untagged: tagging it is
      // POST /tags_entries)
      http.post(`${baseUrl}/entries`, async ({request}) => {
        recordRequest('POST', request.url);
        console.log('OK: MSW intercepted entries POST request');
        try {
          const state = activeEntries();
          const {attributes} = await parseResource(request, {
            type: 'TextEntry',
          });
          const {
            subject,
            body,
            client_id: clientId,
          } = validateFields(textEntryCreateAttributesSchema, attributes);
          const existing =
            clientId === undefined
              ? undefined
              : state.data.find(
                  candidate => candidate.attributes.client_id === clientId
                );
          if (existing !== undefined) {
            // As the API answers: with the entry's junctions and tags.
            const again: TextEntryDocument = {
              data: existing,
              ...includedFor(
                state,
                [existing],
                ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user']
              ),
            };
            return HttpResponse.json(again, {status: 201});
          }
          const entry: TextEntry = {
            type: 'TextEntry',
            id: nextId('TextEntry', state.data),
            attributes: {
              body,
              subject,
              date_updated: nextRevision(
                state.data.map(candidate => candidate.attributes.date_updated)
              ),
              date_created: now(),
              is_public: false,
              reused_count: 0,
              is_deleted: false,
              tag_count: 0,
              client_id: clientId ?? null,
            },
            relationships: {
              ...ownedByTestUser,
              text_entry_to_tag: {data: [], meta: {count: 0}},
            },
          };
          state.data = [...state.data, entry];
          const newEntry: TextEntryDocument = {
            data: entry,
            included: [testUser],
          };
          return HttpResponse.json(newEntry, {status: 201});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Edit or (un)delete an entry: the attributes sent, and a new revision
      // (its tags' too)
      http.patch(`${baseUrl}/entries/:id`, async ({params, request}) => {
        recordRequest('PATCH', request.url);
        console.log('OK: MSW intercepted entry PATCH request:', request.url);
        try {
          const state = activeEntries();
          const entry = findOr404(
            state.data,
            String(params['id']),
            'TextEntry'
          );
          const {attributes} = await parseResource(request, {
            type: 'TextEntry',
            id: entry.id,
          });
          const changes = validateFields(
            textEntryUpdateAttributesSchema,
            attributes
          );
          entry.attributes = {
            ...entry.attributes,
            ...(changes.subject === undefined
              ? {}
              : {subject: changes.subject}),
            ...(changes.body === undefined ? {} : {body: changes.body}),
            ...(changes.is_public === undefined
              ? {}
              : {is_public: changes.is_public}),
            ...(changes.is_deleted === undefined
              ? {}
              : {is_deleted: changes.is_deleted}),
            date_updated: nextRevision(
              state.data.map(candidate => candidate.attributes.date_updated)
            ),
          };
          touchTagsOf(state, entry);
          touchJunctionsOf(state, entry);
          const body: TextEntryDocument = {
            data: entry,
            included: entryIncluded(state, entry),
          };
          return HttpResponse.json(body, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // The junctions, deleted ones too: numbered (newest first with
      // `sort=-date_updated`) or keyset pages, by tag, entry and deletion
      http.get(`${baseUrl}/tags_entries`, ({request}) => {
        recordRequest('GET', request.url);
        try {
          const url = new URL(request.url);
          const state = activeEntries();
          const tagId = url.searchParams.get('filter[tag.id]');
          const entryId = url.searchParams.get('filter[text_entry.id]');
          const deleted = booleanFilter(url, 'is_deleted');
          const rows = allJunctions(state).filter(
            junction =>
              changedSince(url, junction) &&
              (tagId === null ||
                junction.relationships.tag.data.id === tagId) &&
              (entryId === null ||
                junction.relationships.text_entry.data.id === entryId) &&
              (deleted === null || junction.attributes.is_deleted === deleted)
          );
          const paths = includePaths(url, ['user', 'tag', 'text_entry']);
          const after = afterOf(url);
          if (after !== null) {
            const {data, links} = keysetPage(url, rows, after);
            const body: TagTextEntryCursorListDocument = {
              links,
              data,
              ...includedFor(state, data, paths),
            };
            return HttpResponse.json(body, {status: 200});
          }
          const sorted = [...rows].sort(byRevision);
          if (url.searchParams.get('sort') === '-date_updated') {
            sorted.reverse();
          }
          const size = Math.min(
            Number(url.searchParams.get('page[size]') ?? 50) || 50,
            100
          );
          const page = Number(url.searchParams.get('page[number]') ?? 1);
          const pages = Math.max(1, Math.ceil(sorted.length / size));
          if (!Number.isInteger(page) || page < 1 || page > pages) {
            throw apiError(404, CODES.notFound, 'Invalid page.');
          }
          const data = sorted.slice((page - 1) * size, page * size);
          const body: TagTextEntryListDocument = {
            ...pagination(request.url, page, pages, sorted.length),
            data,
            ...includedFor(state, data, paths),
          };
          return HttpResponse.json(body, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Tag an entry: get-or-create its junction with the tag (restoring the
      // pair's deleted one), always 201
      http.post(`${baseUrl}/tags_entries`, async ({request}) => {
        recordRequest('POST', request.url);
        console.log('OK: MSW intercepted tags_entries POST request');
        try {
          const state = activeEntries();
          const {relationships} = await parseResource(request, {
            type: 'TagTextEntryThroughModel',
          });
          const fields = tagTextEntryCreateRelationshipsSchema.shape;
          const errors: ErrorObject[] = [];
          const tagId = relatedId(
            fields.tag,
            'tag',
            relationships,
            id => tags.some(tag => tag.id === id),
            errors
          );
          const entryId = relatedId(
            fields.text_entry,
            'text_entry',
            relationships,
            id => state.data.some(entry => entry.id === id),
            errors
          );
          if (tagId === undefined || entryId === undefined) {
            throw new MockApiError(400, errors);
          }
          const tag = findOr404(tags, tagId, 'Tag');
          const entry = findOr404(state.data, entryId, 'TextEntry');
          let junction = junctionsOf(state).find(
            candidate =>
              candidate.relationships.tag.data.id === tagId &&
              candidate.relationships.text_entry.data.id === entryId
          );
          if (junction === undefined) {
            junction = createJunction(state, tag, entry);
          }
          const body: TagTextEntryDocument = {
            data: junction,
            included: [tag, entry, testUser].sort(byTypeAndId),
          };
          return HttpResponse.json(body, {status: 201});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Reorder: move `top` directly above `bottom`, 200 with no body
      http.post(`${baseUrl}/tags_entries/reorder`, async ({request}) => {
        recordRequest('POST', request.url);
        try {
          if (madeAlready(request)) {
            return new HttpResponse(null, {status: 200});
          }
          const state = activeEntries();
          // A deleted junction is out of the order.
          const [top, bottom] = await reorderPair(
            request,
            'TagTextEntryThroughModel',
            junctionsOf(state)
          );
          const scope = top.relationships.tag.data.id;
          if (bottom.relationships.tag.data.id !== scope) {
            throw apiError(
              400,
              CODES.invalid,
              'top and bottom must share the same ordering scope.'
            );
          }
          moveAbove(
            junctionsOf(state).filter(
              junction => junction.relationships.tag.data.id === scope
            ),
            top,
            bottom,
            nextJunctionRevision(state)
          );
          recordMade(request);
          return new HttpResponse(null, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      http.post(`${baseUrl}/tags/reorder`, async ({request}) => {
        recordRequest('POST', request.url);
        try {
          if (madeAlready(request)) {
            return new HttpResponse(null, {status: 200});
          }
          const [top, bottom] = await reorderPair(request, 'Tag', tags);
          moveAbove(tags, top, bottom, nextTagRevision());
          recordMade(request);
          return new HttpResponse(null, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Delete tag endpoint with stateful behavior
      http.delete(`${baseUrl}/tags/:id`, ({params, request}) => {
        recordRequest('DELETE', request.url);
        const tagId = `${params['id']}`;
        console.log('OK: MSW intercepted tag DELETE request for id:', tagId);

        // Find the tag to delete
        const tagToDelete = tags.find(tag => tag.id === tagId);
        if (!tagToDelete) {
          return HttpResponse.json(
            errorDocument(
              404,
              CODES.notFound,
              'No Tag matches the given query.'
            ),
            {status: 404}
          );
        }

        // Tags are soft-deleted, with a new revision.
        tagToDelete.attributes = {
          ...tagToDelete.attributes,
          is_deleted: true,
          date_updated: nextTagRevision(),
        };
        const deletedTagResponse: TagDocument = {
          data: tagToDelete,
          included: [testUser],
        };

        return HttpResponse.json(deletedTagResponse, {status: 200});
      }),

      // Delete entry endpoint
      http.delete(`${baseUrl}/entries/:id`, ({params, request}) => {
        recordRequest('DELETE', request.url);
        const entryId = `${params['id']}`;
        console.log(
          'OK: MSW intercepted entry DELETE request for id:',
          entryId
        );

        const state = activeEntries();
        const entryToDelete = state.data.find(entry => entry.id === entryId);
        if (!entryToDelete) {
          return HttpResponse.json(
            errorDocument(
              404,
              CODES.notFound,
              'No TextEntry matches the given query.'
            ),
            {status: 404}
          );
        }

        // Entries are soft-deleted, with a new revision (their tags' and
        // junctions' too); the API answers with the deleted entry.
        entryToDelete.attributes = {
          ...entryToDelete.attributes,
          is_deleted: true,
        };
        touchEntry(state, entryToDelete);
        const deletedEntryResponse: TextEntryDocument = {
          data: entryToDelete,
          included: [testUser],
        };
        return HttpResponse.json(deletedEntryResponse, {status: 200});
      }),

      // Untag entry endpoint (tags_entries)
      http.delete(`${baseUrl}/tags_entries/:id`, ({params, request}) => {
        recordRequest('DELETE', request.url);
        const tagEntryId = `${params['id']}`;
        console.log(
          'OK: MSW intercepted untag (tags_entries) DELETE request for id:',
          tagEntryId
        );
        try {
          const state = activeEntries();
          const active = junctionsOf(state).find(
            junction => junction.id === tagEntryId
          );
          if (active !== undefined) {
            deleteJunction(state, active);
          }
          // The junction, deleted: untagging one already untagged changes
          // nothing, and is answered alike (a retried untag).
          const junction = findOr404(
            [...deletedJunctions].reverse(),
            tagEntryId,
            'TagTextEntryThroughModel'
          );
          const body: TagTextEntryDocument = {
            data: junction,
            ...includedFor(state, [junction], ['user', 'tag', 'text_entry']),
          };
          return HttpResponse.json(body, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      })
    );
  }

  // Auth endpoint (different pattern): the API answers `{}`
  handlers.push(
    http.post('http://localhost:9001/api-token-deauth/', ({request}) => {
      recordRequest('POST', request.url);
      return (
        refuseAnotherUsersRequest(request) ??
        HttpResponse.json({}, {status: 200})
      );
    }),
    http.post(
      'https://api-staging.commandsnippets.com/api-token-deauth/',
      ({request}) => {
        recordRequest('POST', request.url);
        return (
          refuseAnotherUsersRequest(request) ??
          HttpResponse.json({}, {status: 200})
        );
      }
    ),
    http.post(
      'https://api.commandsnippets.com/api-token-deauth/',
      ({request}) => {
        recordRequest('POST', request.url);
        return (
          refuseAnotherUsersRequest(request) ??
          HttpResponse.json({}, {status: 200})
        );
      }
    )
  );

  return handlers;
};

export const handlers = createHandlers();

// Reset function to restore original state
/**
 * The last id handed out, per resource. Like SQLite's AUTOINCREMENT, an id is
 * never handed out twice, even after the row that had the highest one is
 * deleted: a reused entry id would pick up the deleted entry's junctions.
 */
const lastIds = new Map<string, number>();

/** Deleting a row retires its id, so nextId never hands it out again. */
function retireId(kind: string, id: string): void {
  lastIds.set(kind, Math.max(lastIds.get(kind) ?? 0, Number(id)));
}

function nextId(kind: string, existing: ReadonlyArray<{id: string}>): string {
  const next =
    Math.max(lastIds.get(kind) ?? 0, ...existing.map(({id}) => Number(id))) + 1;
  lastIds.set(kind, next);
  return String(next);
}

export const resetMSWState = () => {
  lastIds.clear();
  tagsByClientId.clear();
  madeReorders.clear();
  publicGenerations.clear();
  tags = structuredClone(originalTags);
  entriesResponse = structuredClone(originalEntriesResponse);
  runtimeEntriesOverride = null;
  deletedJunctions = [];
  adminUsers = structuredClone(originalAdminUsers);
  adminAuditLog = [];
  restoredAt = null;
};

// Function to set runtime entries override for tests
export const setRuntimeEntriesOverride = (
  override: TextEntryListDocument | null
) => {
  // A copy: the handlers write to it (tagging, editing).
  runtimeEntriesOverride = override === null ? null : structuredClone(override);
  // Deleted junctions were the replaced entries'.
  deletedJunctions = [];
};
