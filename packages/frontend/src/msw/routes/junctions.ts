/** `/tags_entries`: tagging, untagging and reordering an entry in a tag. */
import {
  CODES,
  type TagTextEntryDocument,
  tagTextEntryCreateRelationshipsSchema,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {testUser} from '../fixtures';
import {
  booleanFilter,
  changedSince,
  collectionResponse,
  DEFAULT_INCLUDE,
  includedFor,
  revisionPage,
  testOwner,
} from '../reads';
import {
  apiError,
  type ErrorObject,
  MockApiError,
  parseResource,
  relatedId,
} from '../requests';
import {route} from '../route';
import {
  activeEntries,
  allJunctions,
  byTypeAndId,
  createJunction,
  deleteJunction,
  findOr404,
  junctionsOf,
  moveAbove,
  nextJunctionRevision,
  reorderPair,
} from '../rows';
import {deletedJunctions, madeAlready, recordMade, tags} from '../state';

export const junctionRoutes = (baseUrl: string) => [
  // The junctions, deleted ones too: numbered (newest first with
  // `sort=-date_updated`) or keyset pages, by tag, entry and deletion
  route('GET', `${baseUrl}/tags_entries`, ({request}) => {
    const url = new URL(request.url);
    const state = activeEntries();
    const tagId = url.searchParams.get('filter[tag.id]');
    const entryId = url.searchParams.get('filter[text_entry.id]');
    const deleted = booleanFilter(url, 'is_deleted');
    const rows = allJunctions(state).filter(
      junction =>
        changedSince(url, junction) &&
        (tagId === null || junction.relationships.tag.data.id === tagId) &&
        (entryId === null ||
          junction.relationships.text_entry.data.id === entryId) &&
        (deleted === null || junction.attributes.is_deleted === deleted)
    );
    const page = Number(url.searchParams.get('page[number]') ?? 1);
    return collectionResponse(url, testOwner(), 'tags_entries', rows, () =>
      revisionPage(url, rows, page)
    );
  }),

  // Tag an entry: get-or-create its junction with the tag (restoring the
  // pair's deleted one): 201 for a new junction, 200 for the one there is
  route('POST', `${baseUrl}/tags_entries`, async ({request}) => {
    console.log('OK: MSW intercepted tags_entries POST request');
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
    // New only when the pair has no junction, not even a deleted one
    // (which tagging restores).
    const fresh =
      junction === undefined &&
      !deletedJunctions.some(
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
    return HttpResponse.json(body, {status: fresh ? 201 : 200});
  }),

  // Reorder: move `top` directly above `bottom`, 200 with no body
  route('POST', `${baseUrl}/tags_entries/reorder`, async ({request}) => {
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
  }),

  // Untag entry endpoint (tags_entries)
  route('DELETE', `${baseUrl}/tags_entries/:id`, ({params}) => {
    const tagEntryId = `${params['id']}`;
    console.log(
      'OK: MSW intercepted untag (tags_entries) DELETE request for id:',
      tagEntryId
    );
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
      ...includedFor(state, [junction], DEFAULT_INCLUDE.tags_entries),
    };
    return HttpResponse.json(body, {status: 200});
  }),
];
