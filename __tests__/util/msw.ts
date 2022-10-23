import entriesResponse from '../../test/mocks/entries/entriesResponse';
import {rest} from 'msw';
import {setupServer} from 'msw/node';
import tagsResponse from '../../test/mocks/tags/tagsResponse';

const server = setupServer(
  rest.get('http://localhost:9001/api/v1/tags', (req, res, ctx) => {
    return res(
      ctx.delay(0),
      ctx.status(200, 'Mocked status'),
      ctx.json(tagsResponse)
    );
  }),
  rest.get('http://localhost:9001/api/v1/entries', (req, res, ctx) => {
    return res(
      ctx.delay(0),
      ctx.status(200, 'Mocked status'),
      ctx.json(entriesResponse)
    );
  }),
  rest.post(
    'http://localhost:9001/api/v1/tags_entries/reorder',
    (req, res, ctx) => {
      return res(
        ctx.delay(0),
        ctx.status(200, 'Mocked status'),
        ctx.json({data: null})
      );
    }
  ),
  rest.post('http://localhost:9001/api-token-deauth', (req, res, ctx) => {
    return res(
      ctx.delay(0),
      ctx.status(200, 'Mocked status'),
      ctx.json({data: {}})
    );
  })
);

export default server;
