/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:8081/test/test"}
 */

import '@testing-library/jest-dom';
import App from '../src/App';
import React from 'react';
import {Router} from 'react-router-dom';
import {act} from 'react-dom/test-utils';
import {createMemoryHistory} from 'history';
import entriesResponse from '../test/mocks/entries/entriesResponse';
import {render} from '@testing-library/react';
import {rest} from 'msw';
import {setupServer} from 'msw/node';
import tagsResponse from '../test/mocks/tags/tagsResponse';

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
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('TagList', () => {
  it('Renders', async () => {
    expect(window.location.href).toBe('http://localhost:8081/test/test');
    const history = createMemoryHistory();
    history.push('/test/test');
    await act(async () => {
      render(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      );
      await new Promise(res => setTimeout(res, 3000));
    });
  });
});
