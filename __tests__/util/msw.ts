/**
 * @jest-environment node
 */
import {http, HttpResponse} from 'msw';
import {setupServer} from 'msw/node';

import type {ITagJsonApiResponse} from '../../src/lib/tags';
import type {ITextEntryJsonApiResponse} from '../../src/lib/text_entries';
import entriesResponse from '../../test/mocks/entries/entriesResponse';
import tagsResponse from '../../test/mocks/tags/tagsResponse';

const server = setupServer(
  http.get('http://localhost:9001/api/v1/tags', () => {
    return HttpResponse.json<ITagJsonApiResponse>(tagsResponse, {status: 200});
  }),
  http.get('http://localhost:9001/api/v1/entries', () => {
    return HttpResponse.json<ITextEntryJsonApiResponse>(entriesResponse, {
      status: 200,
    });
  }),
  http.post('http://localhost:9001/api/v1/tags_entries/reorder', () => {
    return HttpResponse.json({data: null}, {status: 200});
  }),
  http.post('http://localhost:9001/api/v1/tags/reorder', () => {
    return HttpResponse.json({data: null}, {status: 200});
  }),
  http.post('http://localhost:9001/api-token-deauth', () => {
    return HttpResponse.json({data: {}}, {status: 200});
  })
);

export default server;
