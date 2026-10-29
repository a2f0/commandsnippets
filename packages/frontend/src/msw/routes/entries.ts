/** `/entries`: list, create, read, edit and delete entries. */
import {
  type TextEntry,
  type TextEntryDocument,
  type TextEntryListDocument,
  textEntryCreateAttributesSchema,
  textEntryUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {now, onePage} from '../documents';
import {ownedByTestUser, testUser} from '../fixtures';
import {afterOf} from '../keyset';
import {
  booleanFilter,
  changedSince,
  entryDocument,
  keysetResponse,
  refuseUsernameFilter,
  testOwner,
} from '../reads';
import {parseResource, validateFields} from '../requests';
import {route} from '../route';
import {
  activeEntries,
  findOr404,
  junctionsOf,
  nextEntryRevision,
  touchEntry,
  touchJunctionsOf,
  touchTagsOf,
} from '../rows';
import {entriesResponse, nextId, runtimeEntriesOverride} from '../state';

export const entryRoutes = (baseUrl: string) => [
  // One entry (deleted ones too)
  route('GET', `${baseUrl}/entries/:id`, ({params}) => {
    const state = activeEntries();
    const entry = findOr404(state.data, String(params['id']), 'TextEntry');
    return HttpResponse.json(entryDocument(state, entry));
  }),

  // Entries endpoint (with optional query parameters)
  route('GET', `${baseUrl}/entries`, ({request}) => {
    // A keyset page, as the API renders it (the sync's reads): deleted
    // entries too, filtered by tag, deletion and revision.
    const url = new URL(request.url);
    refuseUsernameFilter(url);
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
      return keysetResponse(url, after, testOwner(), 'entries', rows);
    }

    // Use runtime override if available, otherwise use default entries
    let responseData: Pick<TextEntryListDocument, 'data' | 'included'> =
      runtimeEntriesOverride || entriesResponse;

    // Handle date filtering if specified
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
        ...(filteredIncluded.length > 0 ? {included: filteredIncluded} : {}),
      };
    }

    const body: TextEntryListDocument = {
      ...onePage(request.url, responseData.data.length),
      ...responseData,
    };
    return HttpResponse.json(body, {
      status: 200,
    });
  }),

  // Create an entry from the attributes sent (untagged: tagging it is
  // POST /tags_entries)
  route('POST', `${baseUrl}/entries`, async ({request}) => {
    console.log('OK: MSW intercepted entries POST request');
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
      return HttpResponse.json(entryDocument(state, existing), {
        status: 201,
      });
    }
    const entry: TextEntry = {
      type: 'TextEntry',
      id: nextId('TextEntry', state.data),
      attributes: {
        body,
        subject,
        date_updated: nextEntryRevision(state),
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
  }),

  // Edit or (un)delete an entry: the attributes sent, and a new revision
  // (its tags' too)
  route('PATCH', `${baseUrl}/entries/:id`, async ({params, request}) => {
    console.log('OK: MSW intercepted entry PATCH request:', request.url);
    const state = activeEntries();
    const entry = findOr404(state.data, String(params['id']), 'TextEntry');
    const {attributes} = await parseResource(request, {
      type: 'TextEntry',
      id: entry.id,
    });
    const changes = validateFields(textEntryUpdateAttributesSchema, attributes);
    entry.attributes = {
      ...entry.attributes,
      ...(changes.subject === undefined ? {} : {subject: changes.subject}),
      ...(changes.body === undefined ? {} : {body: changes.body}),
      ...(changes.is_public === undefined
        ? {}
        : {is_public: changes.is_public}),
      ...(changes.is_deleted === undefined
        ? {}
        : {is_deleted: changes.is_deleted}),
      date_updated: nextEntryRevision(state),
    };
    touchTagsOf(state, entry);
    touchJunctionsOf(state, entry);
    return HttpResponse.json(entryDocument(state, entry), {status: 200});
  }),

  // Delete entry endpoint
  route('DELETE', `${baseUrl}/entries/:id`, ({params}) => {
    const entryId = `${params['id']}`;
    console.log('OK: MSW intercepted entry DELETE request for id:', entryId);

    const state = activeEntries();
    const entryToDelete = findOr404(state.data, entryId, 'TextEntry');

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
];
