/** Public user data (`/users/:username/...`), read-only, with private rows left out. */
import {
  CODES,
  DATA_OWNER_ID_HEADER,
  PUBLIC_REVISION_HEADER,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {onePage} from '../documents';
import {
  adminDataOf,
  type Collection,
  collectionResponse,
  type MockOwner,
  type Row,
  revisionPage,
} from '../reads';
import {apiError} from '../requests';
import {route} from '../route';
import {junctionsOf} from '../rows';
import {publicGenerations} from '../state';

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
  collection?: Collection
): Response {
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
  const rows: readonly Row[] =
    collection === 'tags'
      ? owner.tags
      : collection === 'entries'
        ? owner.state.data
        : junctionsOf(owner.state).filter(
            j => tagId === null || j.relationships.tag.data.id === tagId
          );
  // The first page, counted as the only one.
  return collectionResponse(url, owner, collection, rows, () => ({
    ...onePage(url.href, rows.length),
    data: revisionPage(url, rows, 1).data,
  }));
}

export const publicRoutes = (baseUrl: string) => [
  // Public user data
  route('GET', `${baseUrl}/users/:username`, ({request, params}) =>
    publicResponse(request, String(params['username']))
  ),
  route('GET', `${baseUrl}/users/:username/tags`, ({request, params}) =>
    publicResponse(request, String(params['username']), 'tags')
  ),
  route('GET', `${baseUrl}/users/:username/entries`, ({request, params}) =>
    publicResponse(request, String(params['username']), 'entries')
  ),
  route('GET', `${baseUrl}/users/:username/tags_entries`, ({request, params}) =>
    publicResponse(request, String(params['username']), 'tags_entries')
  ),
];
