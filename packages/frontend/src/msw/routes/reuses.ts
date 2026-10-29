/** `/entry_reuses`: an entry's or the profile's reuses, and recording one. */
import {
  type TextEntryReusedDocument,
  type TextEntryReusedListDocument,
  textEntryReusedCreateAttributesSchema,
  textEntryReusedCreateRelationshipsSchema,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {nextRevision, pagination} from '../documents';
import {ownedByTestUser} from '../fixtures';
import {
  type ErrorObject,
  MockApiError,
  parseResource,
  relatedId,
  validateFields,
} from '../requests';
import {route} from '../route';
import {activeEntries, compare} from '../rows';
import {nextId, reuses, setReuses} from '../state';

export const reuseRoutes = (baseUrl: string) => [
  // One entry's or the whole profile's reuses, newest first with
  // `sort=-date_created`, a page at a time, as the API lists them.
  route('GET', `${baseUrl}/entry_reuses`, ({request}) => {
    const url = new URL(request.url);
    const entryId = url.searchParams.get('filter[text_entry.id]');
    const descending = url.searchParams.get('sort') === '-date_created';
    const size = Number(url.searchParams.get('page[size]') ?? 50);
    const page = Number(url.searchParams.get('page[number]') ?? 1);
    const listed = reuses
      .map(({reuse}) => reuse)
      .filter(
        reuse =>
          entryId === null || reuse.relationships.text_entry.data.id === entryId
      )
      .sort(
        (a, b) =>
          compare(a.attributes.date_created, b.attributes.date_created) *
            (descending ? -1 : 1) || compare(Number(a.id), Number(b.id))
      );
    const pages = Math.max(1, Math.ceil(listed.length / size));
    const body: TextEntryReusedListDocument = {
      data: listed.slice((page - 1) * size, page * size),
      ...pagination(request.url, page, pages, listed.length),
    };
    if (url.searchParams.get('include') === 'text_entry') {
      const entryIds = new Set(
        body.data.map(reuse => reuse.relationships.text_entry.data.id)
      );
      const included = activeEntries().data.filter(
        entry => entryIds.has(entry.id) && !entry.attributes.is_deleted
      );
      if (included.length > 0) body.included = included;
    }
    return HttpResponse.json(body);
  }),

  // Record a reuse: the entry's reused_count goes up (as the API's trigger
  // does), its revision stays. A client id already recorded answers with
  // its reuse, counted once.
  route('POST', `${baseUrl}/entry_reuses`, async ({request}) => {
    const state = activeEntries();
    const {attributes, relationships} = await parseResource(request, {
      type: 'TextEntryReused',
    });
    const {client_id: clientId} = validateFields(
      textEntryReusedCreateAttributesSchema,
      attributes
    );
    const errors: ErrorObject[] = [];
    const entryId = relatedId(
      textEntryReusedCreateRelationshipsSchema.shape.text_entry,
      'text_entry',
      relationships,
      id => state.data.some(entry => entry.id === id),
      errors
    );
    if (entryId === undefined) {
      throw new MockApiError(400, errors);
    }
    let recorded =
      clientId === undefined
        ? undefined
        : reuses.find(candidate => candidate.clientId === clientId)?.reuse;
    if (recorded === undefined) {
      recorded = {
        type: 'TextEntryReused',
        id: nextId(
          'TextEntryReused',
          reuses.map(({reuse}) => reuse)
        ),
        // After every reuse before it, as the API's clock never repeats.
        attributes: {
          date_created: nextRevision(
            reuses.map(({reuse}) => reuse.attributes.date_created)
          ),
        },
        relationships: {
          text_entry: {data: {type: 'TextEntry', id: entryId}},
          ...ownedByTestUser,
        },
      };
      setReuses([...reuses, {reuse: recorded, clientId: clientId ?? null}]);
      state.data = state.data.map(entry =>
        entry.id === entryId
          ? {
              ...entry,
              attributes: {
                ...entry.attributes,
                reused_count: entry.attributes.reused_count + 1,
              },
            }
          : entry
      );
    }
    const reusedId = recorded.relationships.text_entry.data.id;
    const include = new URL(request.url).searchParams.get('include');
    const body: TextEntryReusedDocument = {
      data: recorded,
      ...(include?.split(',').includes('text_entry')
        ? {included: state.data.filter(entry => entry.id === reusedId)}
        : {}),
    };
    return HttpResponse.json(body, {status: 201});
  }),
];
