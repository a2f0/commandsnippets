import {
  type AdminAuditAction,
  type AdminAuditLogEntry,
  type AdminUser,
  CODES,
  type IncludedResource,
  type Tag,
  type TagDocument,
  type TagListDocument,
  type TagTextEntry,
  type TagTextEntryDocument,
  type TextEntry,
  type TextEntryDocument,
  type TextEntryListDocument,
  tagTextEntryCreateRelationshipsSchema,
  tagUpdateAttributesSchema,
  textEntryCreateAttributesSchema,
  textEntryUpdateAttributesSchema,
  type User,
} from '@commandsnippets/api-shared';
import {HttpResponse, http} from 'msw';
import {errorDocument, nextRevision, now, onePage} from './documents';
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
      entry_count: 2,
      order: 1,
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
      entry_count: 0,
      order: 2,
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
      entry_count: 0,
      order: 2,
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
  ],
  included: [
    {
      type: 'TagTextEntryThroughModel',
      id: '1',
      attributes: {
        order: 1,
        date_updated: '2020-04-13T18:20:00',
        date_created: '2020-04-13T18:20:00',
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

/** Advance `entry`'s revision, as a write to its junctions does. */
function touchEntry(state: EntriesState, entry: TextEntry) {
  entry.attributes = {
    ...entry.attributes,
    date_updated: nextRevision(
      state.data.map(candidate => candidate.attributes.date_updated)
    ),
  };
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
 * tag (its highest rank + 1, or 0), then its database triggers (the entry's
 * `tag_count` and the tag's `entry_count` go up, and the tag is last used
 * now; the tag's revision stays) and the entry's new revision.
 */
function createJunction(
  state: EntriesState,
  tag: Tag,
  entry: TextEntry
): TagTextEntry {
  const junctions = junctionsOf(state);
  const ranks = junctions
    .filter(junction => junction.relationships.tag.data.id === tag.id)
    .map(junction => junction.attributes.order);
  const created = now();
  const junction: TagTextEntry = {
    type: 'TagTextEntryThroughModel',
    id: nextId('TagTextEntryThroughModel', junctions),
    attributes: {
      order: ranks.length > 0 ? Math.max(...ranks) + 1 : 0,
      date_updated: nextRevision(
        junctions.map(candidate => candidate.attributes.date_updated)
      ),
      date_created: created,
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
    tag_count: entry.attributes.tag_count + 1,
  };
  tag.attributes = {
    ...tag.attributes,
    entry_count: tag.attributes.entry_count + 1,
    date_last_used: created,
  };
  touchEntry(state, entry);
  linkJunctions(state, entry);
  return junction;
}

/**
 * Untag: remove the junction, then its database triggers (the counts go
 * down, and the tag was last used when its newest remaining junction was
 * made) and the entry's new revision.
 */
function deleteJunction(state: EntriesState, junction: TagTextEntry) {
  retireId('TagTextEntryThroughModel', junction.id);
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
      tag_count: entry.attributes.tag_count - 1,
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
      entry_count: tag.attributes.entry_count - 1,
      date_last_used: remaining.at(-1) ?? null,
    };
  }
}

// Admin page data: the signed-in test user (id 1, staff) and one other.
interface MockAdminUser {
  id: string;
  username: string;
  email: string;
  is_staff: boolean;
  is_active: boolean;
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
  },
  {
    id: '7',
    username: 'alice',
    email: 'alice@example.com',
    is_staff: false,
    is_active: true,
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
    login_count: 4,
    date_updated: '2026-09-01T00:00:00.000000',
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

// Create handlers for all URLs
const createHandlers = () => {
  const handlers = [];

  for (const baseUrl of apiBaseUrls) {
    handlers.push(
      // The signed-in user (read by the admin page)
      http.get(`${baseUrl}/user/`, ({request}) => {
        recordRequest('GET', request.url);
        return HttpResponse.json({
          data: {
            type: 'User',
            id: '1',
            attributes: {
              username: 'test',
              is_staff: true,
              date_updated: '2026-09-01T00:00:00.000000',
            },
          },
        });
      }),

      // Admin API
      http.get(`${baseUrl}/admin/users`, ({request}) => {
        recordRequest('GET', request.url);
        const params = new URL(request.url).searchParams;
        const search = params.get('filter[search]')?.toLowerCase();
        const active = params.get('filter[is_active]');
        const matching = adminUsers.filter(
          user =>
            (search === undefined ||
              user.username.includes(search) ||
              user.email.includes(search)) &&
            (active === null || String(user.is_active) === active)
        );
        return HttpResponse.json(
          listDocument(request.url, matching.map(adminUserResource))
        );
      }),
      http.patch(`${baseUrl}/admin/users/:id`, async ({params, request}) => {
        recordRequest('PATCH', request.url);
        const user = adminUsers.find(
          candidate => candidate.id === params['id']
        );
        if (user === undefined) {
          return HttpResponse.json(
            errorDocument(
              404,
              CODES.notFound,
              'No AdminUser matches the given query.'
            ),
            {status: 404}
          );
        }
        user.is_active = !user.is_active;
        adminAuditLog.unshift({
          id: String(adminAuditLog.length + 1),
          created: '2026-09-28T12:00:00.000000',
          action: user.is_active ? 'activate_user' : 'deactivate_user',
          target: user.username,
        });
        return HttpResponse.json({data: adminUserResource(user)});
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
        const tagsResponse: TagListDocument = {
          ...listDocument(req.request.url, tags),
          included: [testUser],
        };
        return HttpResponse.json(tagsResponse, {
          status: 200,
        });
      }),

      // Create new tag endpoint
      http.post(`${baseUrl}/tags`, async ({request}) => {
        recordRequest('POST', request.url);
        console.log('OK: MSW intercepted tags POST request');

        // Return a new tag response
        const newTag: TagDocument = {
          data: {
            type: 'Tag',
            id: '5', // Use a new ID
            attributes: {
              name: 'new-tag',
              date_updated: now(),
              date_created: now(),
              date_last_used: now(),
              is_deleted: false,
              entry_count: 0,
              order: 5,
            },
            relationships: ownedByTestUser,
          },
          included: [testUser],
        };

        return HttpResponse.json(newTag, {
          status: 201,
        });
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

        // Use runtime override if available, otherwise use default entries
        let responseData: Pick<TextEntryListDocument, 'data' | 'included'> =
          runtimeEntriesOverride || entriesResponse;

        // Handle date filtering if specified
        const url = new URL(req.request.url);
        const dateFilter = url.searchParams.get('filter[date_updated.gt]');

        if (dateFilter && runtimeEntriesOverride) {
          const filterDate = new Date(dateFilter);
          const filteredEntries = runtimeEntriesOverride.data.filter(entry => {
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
          const {subject, body} = validateFields(
            textEntryCreateAttributesSchema,
            attributes
          );
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
              reused_count: 0,
              is_deleted: false,
              tag_count: 0,
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
            ...(changes.is_deleted === undefined
              ? {}
              : {is_deleted: changes.is_deleted}),
            date_updated: nextRevision(
              state.data.map(candidate => candidate.attributes.date_updated)
            ),
          };
          const body: TextEntryDocument = {
            data: entry,
            included: entryIncluded(state, entry),
          };
          return HttpResponse.json(body, {status: 200});
        } catch (error) {
          return errorResponse(error);
        }
      }),

      // Tag an entry: get-or-create its junction with the tag, always 201
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

      // Reorder endpoints: 200 with no body
      http.post(`${baseUrl}/tags_entries/reorder`, ({request}) => {
        recordRequest('POST', request.url);
        return new HttpResponse(null, {status: 200});
      }),

      http.post(`${baseUrl}/tags/reorder`, ({request}) => {
        recordRequest('POST', request.url);
        return new HttpResponse(null, {status: 200});
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

        // Return the deleted tag with is_deleted: true (tags are soft-deleted)
        const deletedTagResponse: TagDocument = {
          data: {
            ...tagToDelete,
            attributes: {
              ...tagToDelete.attributes,
              is_deleted: true,
            },
          },
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

        const entryToDelete = (
          runtimeEntriesOverride ?? entriesResponse
        ).data.find(entry => entry.id === entryId);
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

        // Remove the entry from our mock data
        retireId('TextEntry', entryId);
        entriesResponse.data = entriesResponse.data.filter(
          entry => entry.id !== entryId
        );

        // Entries are soft-deleted: the API answers with the deleted entry.
        const deletedEntryResponse: TextEntryDocument = {
          data: {
            ...entryToDelete,
            attributes: {...entryToDelete.attributes, is_deleted: true},
          },
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
          deleteJunction(
            state,
            findOr404(
              junctionsOf(state),
              tagEntryId,
              'TagTextEntryThroughModel'
            )
          );
        } catch (error) {
          return errorResponse(error);
        }

        // Return 204 No Content for successful untag
        return new HttpResponse(null, {status: 204});
      })
    );
  }

  // Auth endpoint (different pattern): the API answers `{}`
  handlers.push(
    http.post('http://localhost:9001/api-token-deauth/', ({request}) => {
      recordRequest('POST', request.url);
      return HttpResponse.json({}, {status: 200});
    }),
    http.post(
      'https://api-staging.commandsnippets.com/api-token-deauth/',
      ({request}) => {
        recordRequest('POST', request.url);
        return HttpResponse.json({}, {status: 200});
      }
    ),
    http.post(
      'https://api.commandsnippets.com/api-token-deauth/',
      ({request}) => {
        recordRequest('POST', request.url);
        return HttpResponse.json({}, {status: 200});
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
  tags = structuredClone(originalTags);
  entriesResponse = structuredClone(originalEntriesResponse);
  runtimeEntriesOverride = null;
  adminUsers = structuredClone(originalAdminUsers);
  adminAuditLog = [];
};

// Function to set runtime entries override for tests
export const setRuntimeEntriesOverride = (
  override: TextEntryListDocument | null
) => {
  // A copy: the handlers write to it (tagging, editing).
  runtimeEntriesOverride = override === null ? null : structuredClone(override);
};
