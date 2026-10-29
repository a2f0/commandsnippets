/**
 * The rows' bookkeeping, as backend-v2 does it: junctions (soft-deleted,
 * linked from their entries), revisions, tag counts and reorders.
 */
import {
  CODES,
  type IncludedResource,
  MESSAGES,
  reorderAttributesSchema,
  type Tag,
  type TagTextEntry,
  type TextEntry,
} from '@commandsnippets/api-shared';
import {nextRevision, now} from './documents';
import {type EntriesState, ownedByTestUser} from './fixtures';
import {
  apiError,
  type ErrorObject,
  MockApiError,
  parseResource,
  validateFields,
} from './requests';
import {
  deletedJunctions,
  entriesResponse,
  nextId,
  retireId,
  runtimeEntriesOverride,
  setDeletedJunctions,
  tags,
} from './state';

/**
 * The entries (with their junctions in `included`) that the handlers answer
 * with and write to: the runtime override when there is one.
 */
export const activeEntries = (): EntriesState =>
  runtimeEntriesOverride ?? entriesResponse;

const isJunction = (resource: IncludedResource): resource is TagTextEntry =>
  resource.type === 'TagTextEntryThroughModel';

export const junctionsOf = (state: EntriesState) =>
  (state.included ?? []).filter(isJunction);

/** `included` is left out when it would be empty. */
const setIncluded = (state: EntriesState, included: IncludedResource[]) => {
  if (included.length > 0) {
    state.included = included;
  } else {
    delete state.included;
  }
};

export const compare = (a: string | number, b: string | number) =>
  a < b ? -1 : a > b ? 1 : 0;

/** The order the API renders `included` in: by type, then by id (as text). */
export const byTypeAndId = (a: IncludedResource, b: IncludedResource) =>
  compare(a.type, b.type) || compare(a.id, b.id);

/** The API's 404 for a `type` that is not there. */
export const notFound = (type: string) =>
  apiError(404, CODES.notFound, `No ${type} matches the given query.`);

/** The resource of `resources` with `id`, or the API's 404 for `type`. */
export function findOr404<R extends {id: string}>(
  resources: readonly R[],
  id: string,
  type: string
): R {
  const resource = resources.find(candidate => candidate.id === id);
  if (resource === undefined) {
    throw notFound(type);
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
export async function reorderPair<R extends {id: string}>(
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
export function moveAbove<
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
export const nextTagRevision = () =>
  nextRevision(tags.map(tag => tag.attributes.date_updated));

/** The next revision of `state`'s entries. */
export const nextEntryRevision = (state: EntriesState) =>
  nextRevision(state.data.map(entry => entry.attributes.date_updated));

/** Every junction, deleted ones too. */
export const allJunctions = (state: EntriesState) => [
  ...junctionsOf(state),
  ...deletedJunctions,
];

/** The next revision of the junctions. */
export const nextJunctionRevision = (state: EntriesState) =>
  nextRevision(
    allJunctions(state).map(junction => junction.attributes.date_updated)
  );

/**
 * Advance the revisions of `entry`'s junctions, as the database does whenever
 * the entry's revision advances (all to the same one), so the tags' junction
 * lists show the change.
 */
export function touchJunctionsOf(state: EntriesState, entry: TextEntry) {
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
export function touchTagsOf(state: EntriesState, entry: TextEntry) {
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
export function touchEntry(state: EntriesState, entry: TextEntry) {
  entry.attributes = {
    ...entry.attributes,
    date_updated: nextEntryRevision(state),
  };
  touchTagsOf(state, entry);
  touchJunctionsOf(state, entry);
}

/**
 * Tag `entry` with `tag`, as the API does: a junction at the bottom of the
 * tag (its highest rank + 1, or 0), restoring the pair's deleted one if there
 * is one, then its database triggers (the entry's `tag_count` and the tag's
 * `entry_count` go up, the tag is last used now and its revision advances)
 * and the entry's new revision (which advances its tags' and junctions'
 * revisions again).
 */
export function createJunction(
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
  setDeletedJunctions(
    deletedJunctions.filter(candidate => candidate !== deleted)
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
export function deleteJunction(state: EntriesState, junction: TagTextEntry) {
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
