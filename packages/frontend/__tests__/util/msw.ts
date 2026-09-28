import type {
  TagListDocument,
  TextEntryListDocument,
} from '@commandsnippets/api-shared';
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';

import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {tagsResponse} from '../../test/mocks/tags/tagsResponse';

// Define all possible API base URLs
const apiBaseUrls = [
  'http://localhost:9001/api/v1',
  'https://api-staging.commandsnippets.com/api/v1',
  'https://api.commandsnippets.com/api/v1',
];

// Create handlers for all URLs. The responses follow the API contract
// (__tests__/src/msw/contract.spec.ts parses them with api-shared's schemas).
const createHandlers = () => {
  const handlers = [];

  for (const baseUrl of apiBaseUrls) {
    handlers.push(
      // Tags endpoint
      http.get(`${baseUrl}/tags`, () => {
        return HttpResponse.json<TagListDocument>(tagsResponse, {
          status: 200,
        });
      }),

      // Entries endpoint
      http.get(`${baseUrl}/entries`, () => {
        return HttpResponse.json<TextEntryListDocument>(entriesResponse, {
          status: 200,
        });
      }),

      // Reorder endpoints: 200 with no body
      http.post(`${baseUrl}/tags_entries/reorder`, () => {
        return new HttpResponse(null, {status: 200});
      }),

      http.post(`${baseUrl}/tags/reorder`, () => {
        return new HttpResponse(null, {status: 200});
      })
    );
  }

  // Auth endpoint (different pattern): the API answers `{}`
  handlers.push(
    http.post('http://localhost:9001/api-token-deauth/', () => {
      return HttpResponse.json({}, {status: 200});
    }),
    http.post(
      'https://api-staging.commandsnippets.com/api-token-deauth/',
      () => {
        return HttpResponse.json({}, {status: 200});
      }
    ),
    http.post('https://api.commandsnippets.com/api-token-deauth/', () => {
      return HttpResponse.json({}, {status: 200});
    })
  );

  return handlers;
};

const server = setupServer(...createHandlers());

export {server};
