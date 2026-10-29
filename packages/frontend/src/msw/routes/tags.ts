/** `/tags`: list, create, read, edit, reorder and delete tags. */
import {
  CODES,
  type TagDocument,
  type TagListDocument,
  tagCreateAttributesSchema,
  tagUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {now} from '../documents';
import {ownedByTestUser, testUser} from '../fixtures';
import {afterOf} from '../keyset';
import {
  changedSince,
  keysetResponse,
  refuseUsernameFilter,
  testOwner,
} from '../reads';
import {apiError, parseResource, validateFields} from '../requests';
import {route} from '../route';
import {findOr404, moveAbove, nextTagRevision, reorderPair} from '../rows';
import {
  madeAlready,
  nextId,
  recordMade,
  setTags,
  tags,
  tagsByClientId,
} from '../state';
import {listDocument} from './admin';

export const tagRoutes = (baseUrl: string) => [
  // Tags endpoint (with optional query parameters)
  route('GET', `${baseUrl}/tags`, ({request}) => {
    console.log('OK: MSW intercepted tags request:', request.url);
    const url = new URL(request.url);
    refuseUsernameFilter(url);
    // A keyset page, as the API renders it (the sync's reads).
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
    const tagsResponse: TagListDocument = {
      ...listDocument(request.url, tags),
      included: [testUser],
    };
    return HttpResponse.json(tagsResponse, {
      status: 200,
    });
  }),

  // Create a tag (201), or answer with the user's of that name (200,
  // bringing back a deleted one), as the API does; a create naming a
  // client id a tag has answers with that tag, whatever it is called now,
  // as its first attempt was answered (201 when that attempt made it)
  route('POST', `${baseUrl}/tags`, async ({request}) => {
    console.log('OK: MSW intercepted tags POST request');
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
      return HttpResponse.json(again, {
        status: made.attributes.client_id === clientId ? 201 : 200,
      });
    }
    let tag = tags.find(candidate => candidate.attributes.name === name);
    if (tag !== undefined && clientId !== undefined) {
      tagsByClientId.set(clientId, tag.id);
    }
    const isNew = tag === undefined;
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
          order: Math.max(-1, ...tags.map(other => other.attributes.order)) + 1,
          client_id: clientId ?? null,
        },
        relationships: ownedByTestUser,
      };
      setTags([...tags, tag]);
    } else if (tag.attributes.is_deleted) {
      tag.attributes = {
        ...tag.attributes,
        is_deleted: false,
        date_updated: nextTagRevision(),
      };
    }
    const body: TagDocument = {data: tag, included: [testUser]};
    return HttpResponse.json(body, {status: isNew ? 201 : 200});
  }),

  // One tag (deleted ones too)
  route('GET', `${baseUrl}/tags/:id`, ({params}) => {
    const tag = findOr404(tags, String(params['id']), 'Tag');
    const body: TagDocument = {data: tag, included: [testUser]};
    return HttpResponse.json(body);
  }),

  // Rename or (un)delete a tag: the attributes sent, and a new revision
  route('PATCH', `${baseUrl}/tags/:id`, async ({params, request}) => {
    console.log('OK: MSW intercepted tag PATCH request:', request.url);
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
      ...(changes.is_public === undefined
        ? {}
        : {is_public: changes.is_public}),
      ...(changes.is_deleted === undefined
        ? {}
        : {is_deleted: changes.is_deleted}),
      date_updated: nextTagRevision(),
    };
    const body: TagDocument = {data: tag, included: [testUser]};
    return HttpResponse.json(body, {status: 200});
  }),

  route('POST', `${baseUrl}/tags/reorder`, async ({request}) => {
    if (madeAlready(request)) {
      return new HttpResponse(null, {status: 200});
    }
    const [top, bottom] = await reorderPair(request, 'Tag', tags);
    moveAbove(tags, top, bottom, nextTagRevision());
    recordMade(request);
    return new HttpResponse(null, {status: 200});
  }),

  // Delete tag endpoint with stateful behavior
  route('DELETE', `${baseUrl}/tags/:id`, ({params}) => {
    const tagId = `${params['id']}`;
    console.log('OK: MSW intercepted tag DELETE request for id:', tagId);

    const tagToDelete = findOr404(tags, tagId, 'Tag');

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
];
