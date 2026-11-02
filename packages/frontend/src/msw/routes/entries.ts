/** `/entries`: list, create, read, edit and delete entries. */
import {
  type Cursor,
  type TextEntryDocument,
  type TextEntryListDocument,
  textEntryCreateAttributesSchema,
  textEntryUpdateAttributesSchema,
} from '@commandsnippets/api-shared';
import {HttpResponse} from 'msw/http';
import {now, onePage, withUser} from '../documents';
import type {EntriesState} from '../fixtures';
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
import {type RouteInfo, route} from '../route';
import {
  activeEntries,
  findOr404,
  junctionsOf,
  newMockEntry,
  nextEntryRevision,
  touchEntry,
  touchJunctionsOf,
  touchTagsOf,
} from '../rows';
import {entriesResponse, runtimeEntriesOverride} from '../state';

/** One entry (deleted ones too). */
function getEntry({params}: RouteInfo) {
  const state = activeEntries();
  const entry = findOr404(state.data, String(params['id']), 'TextEntry');
  return HttpResponse.json(entryDocument(state, entry));
}

/**
 * A keyset page, as the API renders it (the sync's reads): deleted entries
 * too, filtered by tag, deletion and revision.
 */
function entriesKeysetResponse(url: URL, after: Cursor) {
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

/**
 * The runtime override's entries updated after `since`, with the junctions
 * of those and the rest of its `included` (left out when it would be empty).
 */
function overrideUpdatedAfter(
  override: TextEntryListDocument,
  since: string
): EntriesState {
  const filterDate = new Date(since);
  const data = override.data.filter(
    entry => new Date(entry.attributes.date_updated) > filterDate
  );
  const entryIds = data.map(entry => entry.id);
  const all = override.included ?? [];
  const included = [
    ...all.filter(
      item =>
        item.type === 'TagTextEntryThroughModel' &&
        entryIds.includes(item.relationships.text_entry.data.id)
    ),
    ...all.filter(item => item.type !== 'TagTextEntryThroughModel'),
  ];
  return {
    data,
    ...(included.length > 0 ? {included} : {}),
  };
}

/**
 * The entries: a keyset page, or else all of them (the runtime override's
 * when a test set one, which `filter[date_updated.gt]` filters).
 */
function listEntries({request}: RouteInfo) {
  const url = new URL(request.url);
  refuseUsernameFilter(url);
  const after = afterOf(url);
  if (after !== null) {
    return entriesKeysetResponse(url, after);
  }
  const since = url.searchParams.get('filter[date_updated.gt]');
  const listed =
    since && runtimeEntriesOverride
      ? overrideUpdatedAfter(runtimeEntriesOverride, since)
      : (runtimeEntriesOverride ?? entriesResponse);
  const body: TextEntryListDocument = {
    ...onePage(request.url, listed.data.length),
    ...listed,
  };
  return HttpResponse.json(body);
}

/**
 * Create an entry from the attributes sent (untagged: tagging it is POST
 * /tags_entries); a create naming a client id an entry has answers with that
 * entry, its junctions and tags, as the API does.
 */
async function createEntry({request}: RouteInfo) {
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
    return HttpResponse.json(entryDocument(state, existing), {
      status: 201,
    });
  }
  const entry = newMockEntry(state, {
    subject,
    body,
    is_public: false,
    date_created: now(),
    reused_count: 0,
    client_id: clientId ?? null,
  });
  state.data = [...state.data, entry];
  const document: TextEntryDocument = withUser(entry);
  return HttpResponse.json(document, {status: 201});
}

/**
 * Edit or (un)delete an entry: the attributes sent, and a new revision (its
 * tags' and junctions' too).
 */
async function patchEntry({params, request}: RouteInfo) {
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
    ...(changes.is_public === undefined ? {} : {is_public: changes.is_public}),
    ...(changes.is_deleted === undefined
      ? {}
      : {is_deleted: changes.is_deleted}),
    date_updated: nextEntryRevision(state),
  };
  touchTagsOf(state, entry);
  touchJunctionsOf(state, entry);
  return HttpResponse.json(entryDocument(state, entry));
}

/**
 * Entries are soft-deleted, with a new revision (their tags' and junctions'
 * too); the API answers with the deleted entry.
 */
function deleteEntry({params}: RouteInfo) {
  const state = activeEntries();
  const entry = findOr404(state.data, String(params['id']), 'TextEntry');
  entry.attributes = {...entry.attributes, is_deleted: true};
  touchEntry(state, entry);
  const body: TextEntryDocument = withUser(entry);
  return HttpResponse.json(body);
}

export const entryRoutes = (baseUrl: string) => [
  route('GET', `${baseUrl}/entries/:id`, getEntry),
  route('GET', `${baseUrl}/entries`, listEntries),
  route('POST', `${baseUrl}/entries`, createEntry),
  route('PATCH', `${baseUrl}/entries/:id`, patchEntry),
  route('DELETE', `${baseUrl}/entries/:id`, deleteEntry),
];
