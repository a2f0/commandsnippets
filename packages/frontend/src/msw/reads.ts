/**
 * The collection reads: an owner's data, `included`, numbered and keyset
 * pages, and the filters the API takes.
 */
import {
  CODES,
  type Cursor,
  type IncludedResource,
  MESSAGES,
  parseDateTime,
  type Tag,
  type TagCursorListDocument,
  type TagListDocument,
  type TagTextEntry,
  type TextEntry,
  type TextEntryDocument,
  type User,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {pagination} from './documents';
import {
  aliceEntries,
  aliceTags,
  aliceUser,
  type EntriesState,
  testUser,
} from './fixtures';
import {afterOf, byRevision, keysetPage, positionOf} from './keyset';
import {apiError} from './requests';
import {activeEntries, byTypeAndId, junctionsOf, notFound} from './rows';
import {deletedJunctions, tags} from './state';

/**
 * A user's data as the mocks hold it: the user, their tags, their entries
 * (with their junctions), and their deleted junctions.
 */
export interface MockOwner {
  user: User;
  tags: readonly Tag[];
  state: EntriesState;
  deleted: readonly TagTextEntry[];
}

/** A row of a user's data: a tag, an entry or a junction. */
export type Row = Tag | TextEntry | TagTextEntry;

/** The signed-in test user's data (what the owner-only routes answer). */
export const testOwner = (): MockOwner => ({
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
export function includedFor(
  state: EntriesState,
  primary: readonly Row[],
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

/** A collection of the user's data, by its path. */
export type Collection = 'tags' | 'entries' | 'tags_entries';

/**
 * Each collection's default `include` paths, as the API's: a tag's owner;
 * an entry's junctions, their tags and its owner; a junction's three ends.
 */
export const DEFAULT_INCLUDE: Record<Collection, readonly string[]> = {
  tags: ['user'],
  entries: ['text_entry_to_tag', 'text_entry_to_tag.tag', 'user'],
  tags_entries: ['user', 'tag', 'text_entry'],
};

/** `entry`'s document, with its default `included`. */
export const entryDocument = (
  state: EntriesState,
  entry: TextEntry
): TextEntryDocument => ({
  data: entry,
  ...includedFor(state, [entry], DEFAULT_INCLUDE.entries),
});

/** A numbered page of a collection (`page[number]`), without `included`. */
type NumberedPage<R extends Row> = Pick<TagListDocument, 'links' | 'meta'> & {
  data: R[];
};

/**
 * What the request's `include` (or `collection`'s default) adds to a page of
 * `data`, from `owner`'s data.
 */
const includedOf = (
  url: URL,
  owner: MockOwner,
  collection: Collection,
  data: readonly Row[]
) =>
  includedFor(
    owner.state,
    data,
    includePaths(url, DEFAULT_INCLUDE[collection]),
    owner
  );

/**
 * The keyset page of `rows` (those of `collection` the request matches)
 * after `after`, the request's cursor (the sync's reads), as the API
 * renders it.
 */
export function keysetResponse<R extends Row>(
  url: URL,
  after: Cursor,
  owner: MockOwner,
  collection: Collection,
  rows: readonly R[]
): Response {
  const {data, links} = keysetPage(url, rows, after);
  const body: Pick<TagCursorListDocument, 'links' | 'included'> & {
    data: R[];
  } = {links, data, ...includedOf(url, owner, collection, data)};
  return HttpResponse.json(body);
}

/**
 * A page of `rows` (those of `collection` the request matches) as the API
 * renders it: the keyset page after the request's cursor (`page[after]`),
 * or else the numbered page `numbered` makes.
 */
export function collectionResponse<R extends Row>(
  url: URL,
  owner: MockOwner,
  collection: Collection,
  rows: readonly R[],
  numbered: () => NumberedPage<R>
): Response {
  const after = afterOf(url);
  if (after !== null) {
    return keysetResponse(url, after, owner, collection, rows);
  }
  const page = numbered();
  const body: NumberedPage<R> & Pick<TagListDocument, 'included'> = {
    ...page,
    ...includedOf(url, owner, collection, page.data),
  };
  return HttpResponse.json(body);
}

/**
 * Page `page` of `rows` in revision order (newest first with
 * `sort=-date_updated`), `page[size]` to a page (50 by default, 100 at
 * most), as the API numbers them; the API's 404 for a page there is not.
 */
export function revisionPage<R extends Row>(
  url: URL,
  rows: readonly R[],
  page: number
): NumberedPage<R> {
  const sorted = [...rows].sort(byRevision);
  if (url.searchParams.get('sort') === '-date_updated') {
    sorted.reverse();
  }
  const size = Math.min(
    Number(url.searchParams.get('page[size]') ?? 50) || 50,
    100
  );
  const pages = Math.max(1, Math.ceil(sorted.length / size));
  if (!Number.isInteger(page) || page < 1 || page > pages) {
    throw apiError(404, CODES.notFound, 'Invalid page.');
  }
  return {
    ...pagination(url.href, page, pages, sorted.length),
    data: sorted.slice((page - 1) * size, page * size),
  };
}

/**
 * The signed-in user's own lists take no username filter: refused as an
 * invalid filter, as the API refuses it (400).
 */
export function refuseUsernameFilter(url: URL): void {
  for (const name of ['user.username', 'user__username']) {
    if (url.searchParams.has(`filter[${name}]`)) {
      throw apiError(
        400,
        CODES.invalid,
        MESSAGES.invalidFilter('user__username')
      );
    }
  }
}

/** `filter[name]` as a boolean, when given. */
export const booleanFilter = (url: URL, name: string) => {
  const value = url.searchParams.get(`filter[${name}]`);
  return value === null ? null : value === 'true' || value === '1';
};

/**
 * Whether `resource` passes `filter[date_updated.gt]`, when given: a revision
 * strictly newer (by the timestamp alone, as the API compares).
 */
export const changedSince = (url: URL, resource: Row) => {
  const since = url.searchParams.get('filter[date_updated.gt]');
  return (
    since === null ||
    positionOf(resource).dateUpdated > (parseDateTime(since) ?? since)
  );
};

/**
 * The data of admin user `id` (`/admin/users/:id/...`): the test user's, or
 * alice's; the API's 404 for anyone else.
 */
export function adminDataOf(id: string): MockOwner {
  if (id === '1') {
    return testOwner();
  }
  if (id === '7') {
    return {user: aliceUser, tags: aliceTags, state: aliceEntries, deleted: []};
  }
  throw notFound('AdminUser');
}
