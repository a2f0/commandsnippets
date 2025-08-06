/**
 * @jest-environment node
 */
import {HttpResponse, http} from 'msw';
import {setupServer} from 'msw/node';

import type {ITagJsonApiResponse} from '../../src/lib/tags';
import type {ITextEntryJsonApiResponse} from '../../src/lib/text_entries';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';
import {tagsResponse} from '../../test/mocks/tags/tagsResponse';

// Define all possible API base URLs
const apiBaseUrls = [
  'http://localhost:9001/api/v1',
  'https://api.staging.tearleads.com/api/v1',
  'https://api.tearleads.com/api/v1',
];

// Create handlers for all URLs
const createHandlers = () => {
  const handlers = [];

  for (const baseUrl of apiBaseUrls) {
    handlers.push(
      // Tags endpoint
      http.get(`${baseUrl}/tags`, () => {
        return HttpResponse.json<ITagJsonApiResponse>(tagsResponse, {
          status: 200,
        });
      }),

      // Entries endpoint
      http.get(`${baseUrl}/entries`, () => {
        return HttpResponse.json<ITextEntryJsonApiResponse>(entriesResponse, {
          status: 200,
        });
      }),

      // Reorder endpoints
      http.post(`${baseUrl}/tags_entries/reorder`, () => {
        return HttpResponse.json({data: null}, {status: 200});
      }),

      http.post(`${baseUrl}/tags/reorder`, () => {
        return HttpResponse.json({data: null}, {status: 200});
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

const server = setupServer(...createHandlers());

export {server};
