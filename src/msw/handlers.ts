import {HttpResponse, http} from 'msw';
import type {ITagJsonApiResponse, ITagJsonApiResponseSingle} from '../lib/tags';
import type {ITextEntryJsonApiResponse} from '../lib/text_entries';

// Mock data for tags (matches test/mocks/tags/tagsResponse.ts)
// Keep original immutable for resets
const originalTagsResponse: ITagJsonApiResponse = {
  data: [
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
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
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
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
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
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
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
      relationships: {
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
    },
  ],
  included: [
    {
      type: 'User',
      id: '1',
      attributes: {
        username: 'test',
        date_updated: '2020-04-13T18:20:00',
      },
    },
  ],
  links: {
    next: null,
  },
};

// Mutable copy for stateful operations
let tagsResponse: ITagJsonApiResponse = JSON.parse(
  JSON.stringify(originalTagsResponse)
);

// Original immutable entries for resets
const originalEntriesResponse: ITextEntryJsonApiResponse = {
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
        user: {
          data: {
            type: 'User',
            id: '1',
          },
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
        user: {
          data: {
            type: 'User',
            id: '1',
          },
        },
      },
    },
  ],
  included: [],
  links: {
    next: null,
  },
};

// Mutable copy for stateful operations
let entriesResponse: ITextEntryJsonApiResponse = JSON.parse(
  JSON.stringify(originalEntriesResponse)
);

// Define all possible API base URLs
const apiBaseUrls = [
  'http://localhost:9001/api/v1',
  'https://api.staging.tearleads.com/api/v1',
  'https://api.tearleads.com/api/v1',
] as const;

// Create handlers for all URLs
const createHandlers = () => {
  const handlers = [];

  for (const baseUrl of apiBaseUrls) {
    handlers.push(
      // Health check endpoint
      http.get(`${baseUrl}/health`, () => {
        console.log('✅ MSW intercepted health check request');
        return HttpResponse.json(
          {status: 'ok'},
          {
            status: 200,
          }
        );
      }),

      // Tags endpoint (with optional query parameters)
      http.get(`${baseUrl}/tags`, req => {
        console.log('✅ MSW intercepted tags request:', req.request.url);
        return HttpResponse.json(tagsResponse, {
          status: 200,
        });
      }),

      // Create new tag endpoint
      http.post(`${baseUrl}/tags`, async () => {
        console.log('✅ MSW intercepted tags POST request');

        // Return a new tag response
        const newTag: ITagJsonApiResponseSingle = {
          data: {
            type: 'Tag',
            id: '5', // Use a new ID
            attributes: {
              name: 'new-tag',
              date_updated: new Date().toISOString(),
              date_created: new Date().toISOString(),
              date_last_used: new Date().toISOString(),
              is_deleted: false,
              entry_count: 0,
              order: 5,
            },
            relationships: {
              user: {
                data: {
                  type: 'User',
                  id: '1',
                },
              },
            },
          },
          included: [
            {
              type: 'User',
              id: '1',
              attributes: {
                username: 'test',
                date_updated: '2020-04-13T18:20:00',
              },
            },
          ],
        };

        return HttpResponse.json(newTag, {
          status: 201,
        });
      }),

      // Entries endpoint (with optional query parameters)
      http.get(`${baseUrl}/entries`, req => {
        console.log('✅ MSW intercepted entries request:', req.request.url);
        
        // Always return entries - simplify for testing
        return HttpResponse.json(entriesResponse, {
          status: 200,
        });
      }),

      // Entries by tag endpoint
      http.get(`${baseUrl}/tags/:tagId/entries`, ({params}) => {
        const tagId = `${params['tagId']}`;
        console.log(
          '✅ MSW intercepted entries by tag request for tag id:',
          tagId
        );

        // For tag 1, return the entries, for others return empty
        if (tagId === '1') {
          return HttpResponse.json(entriesResponse, {
            status: 200,
          });
        }

        return HttpResponse.json(
          {
            data: [],
            included: [],
            links: {next: null},
          },
          {
            status: 200,
          }
        );
      }),

      // Create new entry endpoint
      http.post(`${baseUrl}/entries`, async () => {
        console.log('✅ MSW intercepted entries POST request');

        // Return a new entry response
        const newEntry = {
          data: {
            type: 'TextEntry',
            id: '3',
            attributes: {
              body: 'new entry body',
              subject: 'new-entry-subject',
              date_updated: new Date().toISOString(),
              date_created: new Date().toISOString(),
              reused_count: 0,
              is_deleted: false,
              tag_count: 1,
            },
            relationships: {
              user: {
                data: {
                  type: 'User',
                  id: '1',
                },
              },
            },
          },
          included: [
            {
              type: 'User',
              id: '1',
              attributes: {
                username: 'test',
                date_updated: '2020-04-13T18:20:00',
              },
            },
          ],
        };

        return HttpResponse.json(newEntry, {
          status: 201,
        });
      }),

      // Reorder endpoints
      http.post(`${baseUrl}/tags_entries/reorder`, () => {
        return HttpResponse.json({data: null}, {status: 200});
      }),

      http.post(`${baseUrl}/tags/reorder`, () => {
        return HttpResponse.json({data: null}, {status: 200});
      }),

      // Delete tag endpoint with stateful behavior
      http.delete(`${baseUrl}/tags/:id`, ({params}) => {
        const tagId = `${params['id']}`;
        console.log('✅ MSW intercepted tag DELETE request for id:', tagId);

        // Remove the tag from our mock data
        tagsResponse.data = tagsResponse.data.filter(tag => tag.id !== tagId);

        return HttpResponse.json(null, {status: 204});
      }),

      // Delete entry endpoint
      http.delete(`${baseUrl}/entries/:id`, ({params}) => {
        const entryId = `${params['id']}`;
        console.log('✅ MSW intercepted entry DELETE request for id:', entryId);

        // Remove the entry from our mock data
        entriesResponse.data = entriesResponse.data.filter(
          entry => entry.id !== entryId
        );

        return HttpResponse.json(null, {status: 204});
      }),

      // Untag entry endpoint (tags_entries)
      http.delete(`${baseUrl}/tags_entries/:id`, ({params}) => {
        const tagEntryId = `${params['id']}`;
        console.log(
          '✅ MSW intercepted untag (tags_entries) DELETE request for id:',
          tagEntryId
        );

        // Return 204 No Content for successful untag
        return HttpResponse.json(null, {status: 204});
      })
    );
  }

  // Auth endpoint (different pattern)
  handlers.push(
    http.post('http://localhost:9001/api-token-deauth', () => {
      return HttpResponse.json({data: {}}, {status: 200});
    }),
    http.post('https://api.staging.tearleads.com/api-token-deauth', () => {
      return HttpResponse.json({data: {}}, {status: 200});
    }),
    http.post('https://api.tearleads.com/api-token-deauth', () => {
      return HttpResponse.json({data: {}}, {status: 200});
    })
  );

  return handlers;
};

export const handlers = createHandlers();

// Reset function to restore original state
export const resetMSWState = () => {
  tagsResponse = JSON.parse(JSON.stringify(originalTagsResponse));
  entriesResponse = JSON.parse(JSON.stringify(originalEntriesResponse));
};
