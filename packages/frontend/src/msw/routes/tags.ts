/** `/tags`: list, create, read, edit, reorder and delete tags. */
import {
  CODES,
  type TagDocument,
  type TagListDocument,
  tagCreateAttributesSchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {listDocument, now, withUser} from '../documents';
import {testUser} from '../fixtures';
import {afterOf} from '../keyset';
import {
  changedSince,
  keysetResponse,
  refuseUsernameFilter,
  testOwner,
} from '../reads';
import {apiError, parseResource, validateFields} from '../requests';
import {type RouteInfo, route} from '../route';
import {
  findOr404,
  moveAbove,
  newMockTag,
  nextTagRevision,
  reorderPair,
} from '../rows';
import {madeAlready, recordMade, setTags, tags, tagsByClientId} from '../state';

/** The tags: a keyset page (the sync's reads), or else all of them. */
function listTags({request}: RouteInfo) {
  const url = new URL(request.url);
  refuseUsernameFilter(url);
  const after = afterOf(url);
  if (after !== null) {
    return keysetResponse(
      url,
      after,
      testOwner(),
      'tags',
      tags.filter(tag => changedSince(url, tag))
    );
  }
  const body: TagListDocument = {
    ...listDocument(request.url, tags),
    included: [testUser],
  };
  return HttpResponse.json(body);
}

/**
 * The tag an earlier create naming `clientId` was answered with, whatever it
 * is called now: the one it made, or the user's of the name it had.
 */
function tagMadeFor(clientId: string | undefined) {
  if (clientId === undefined) {
    return undefined;
  }
  const answered = tagsByClientId.get(clientId);
  return tags.find(
    candidate =>
      candidate.attributes.client_id === clientId || candidate.id === answered
  );
}

/**
 * Create a tag (201), or answer with the user's of that name (200, bringing
 * back a deleted one), as the API does; a create naming a client id a tag
 * has answers with that tag, as its first attempt was answered (201 when
 * that attempt made it).
 */
async function createTag({request}: RouteInfo) {
  const {attributes} = await parseResource(request, {type: 'Tag'});
  const {name, client_id: clientId} = validateFields(
    tagCreateAttributesSchema,
    attributes
  );
  const made = tagMadeFor(clientId);
  if (made !== undefined) {
    return HttpResponse.json(withUser(made), {
      status: made.attributes.client_id === clientId ? 201 : 200,
    });
  }
  const named = tags.find(candidate => candidate.attributes.name === name);
  if (named === undefined) {
    const created = now();
    const tag = newMockTag({
      name,
      order: Math.max(-1, ...tags.map(other => other.attributes.order)) + 1,
      is_public: false,
      date_created: created,
      date_last_used: created,
      client_id: clientId ?? null,
    });
    setTags([...tags, tag]);
    return HttpResponse.json(withUser(tag), {status: 201});
  }
  if (clientId !== undefined) {
    tagsByClientId.set(clientId, named.id);
  }
  if (named.attributes.is_deleted) {
    named.attributes = {
      ...named.attributes,
      is_deleted: false,
      date_updated: nextTagRevision(),
    };
  }
  return HttpResponse.json(withUser(named), {status: 200});
}

/** One tag (deleted ones too). */
function getTag({params}: RouteInfo) {
  const tag = findOr404(tags, String(params['id']), 'Tag');
  const body: TagDocument = withUser(tag);
  return HttpResponse.json(body);
}

/** Rename or (un)delete a tag: the attributes sent, and a new revision. */
async function patchTag({params, request}: RouteInfo) {
  const tag = findOr404(tags, String(params['id']), 'Tag');
  const {attributes} = await parseResource(request, {
    type: 'Tag',
    id: tag.id,
  });
  const changes = validateFields(tagUpdateAttributesSchema, attributes);
  // A user's tags have unique names, the deleted ones' included.
  if (
    tags.some(
      other => other.id !== tag.id && other.attributes.name === changes.name
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
    ...(changes.is_public === undefined ? {} : {is_public: changes.is_public}),
    ...(changes.is_deleted === undefined
      ? {}
      : {is_deleted: changes.is_deleted}),
    date_updated: nextTagRevision(),
  };
  const body: TagDocument = withUser(tag);
  return HttpResponse.json(body);
}

/** Reorder: move `top` directly above `bottom`, 200 with no body. */
async function reorderTags({request}: RouteInfo) {
  if (madeAlready(request)) {
    return new HttpResponse(null, {status: 200});
  }
  const [top, bottom] = await reorderPair(request, 'Tag', tags);
  moveAbove(tags, top, bottom, nextTagRevision());
  recordMade(request);
  return new HttpResponse(null, {status: 200});
}

/** Tags are soft-deleted, with a new revision. */
function deleteTag({params}: RouteInfo) {
  const tag = findOr404(tags, String(params['id']), 'Tag');
  tag.attributes = {
    ...tag.attributes,
    is_deleted: true,
    date_updated: nextTagRevision(),
  };
  const body: TagDocument = withUser(tag);
  return HttpResponse.json(body);
}

export const tagRoutes = (baseUrl: string) => [
  route('GET', `${baseUrl}/tags`, listTags),
  route('POST', `${baseUrl}/tags`, createTag),
  route('GET', `${baseUrl}/tags/:id`, getTag),
  route('PATCH', `${baseUrl}/tags/:id`, patchTag),
  route('POST', `${baseUrl}/tags/reorder`, reorderTags),
  route('DELETE', `${baseUrl}/tags/:id`, deleteTag),
];
