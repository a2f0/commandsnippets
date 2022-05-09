/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:8081/test/test-tag-1"}
 */

import '@testing-library/jest-dom';
import {act, render, screen} from '@testing-library/react';
import App from '../src/App';
import React from 'react';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';
import entriesResponse from '../test/mocks/entries/entriesResponse';
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

describe('Entries List', () => {
  it('Reorders', async () => {
    expect(window.location.href).toBe('http://localhost:8081/test/test-tag-1');
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    await act(async () => {
      render(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      );
      await new Promise(res => setTimeout(res, 3000));
      expect(screen.getByText(/entry-1-subject/i)).toBeInTheDocument();
      expect(screen.getByText(/entry-1-body/i)).toBeInTheDocument();
      expect(screen.getByText(/entry-2-subject/i)).toBeInTheDocument();
      expect(screen.getByText(/entry-2-body/i)).toBeInTheDocument();
      const entries = screen.getAllByRole('entry');
      expect(entries).toHaveLength(2);
    });
  });
});
