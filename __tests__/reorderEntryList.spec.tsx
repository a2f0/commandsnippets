/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:8081/test/test-tag-1"}
 */

import '@testing-library/jest-dom';
import {act, fireEvent, render, screen} from '@testing-library/react';
import App from '../src/App';
import React from 'react';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';
import entriesResponse from '../test/mocks/entries/entriesResponse';
import {rest} from 'msw';
import {setupServer} from 'msw/node';
import tagsResponse from '../test/mocks/tags/tagsResponse';
import userEvent from '@testing-library/user-event';

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
  )
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
      await new Promise(res => setTimeout(res, 250));
      expect(screen.getByText(/entry-1-subject/i)).toBeInTheDocument();
      expect(screen.getByText(/entry-1-body/i)).toBeInTheDocument();
      expect(screen.getByText(/entry-2-subject/i)).toBeInTheDocument();
      expect(screen.getByText(/entry-2-body/i)).toBeInTheDocument();
      let entries = screen.getAllByRole('entry');
      expect(entries).toHaveLength(4);
      expect(entries[0]).toHaveTextContent('entry-1-subject');
      expect(entries[0]).toHaveTextContent('entry-1-body');
      expect(entries[1]).toHaveTextContent('entry-2-subject');
      expect(entries[1]).toHaveTextContent('entry-2-body');
      expect(entries[2]).toHaveTextContent('entry-3-subject');
      expect(entries[2]).toHaveTextContent('entry-3-body');
      expect(entries[3]).toHaveTextContent('entry-4-subject');
      expect(entries[3]).toHaveTextContent('entry-4-body');
      const user = userEvent.setup();
      const entryDragHandleContainers = screen.getAllByRole(
        'entryDragHandleContainer'
      );
      expect(entryDragHandleContainers).toHaveLength(4);
      await user.pointer({target: entryDragHandleContainers[0]});
      const entryDragHandle = screen.getByRole('entryDragHandle');
      fireEvent.dragStart(entryDragHandle);
      fireEvent.dragEnter(entries[2]);
      fireEvent.dragOver(entries[2]);
      await new Promise(res => setTimeout(res, 0));
      fireEvent.drop(entries[3]);
      entries = screen.getAllByRole('entry');
      expect(entries).toHaveLength(4);
      expect(entries[0]).toHaveTextContent('entry-2-subject');
      expect(entries[0]).toHaveTextContent('entry-2-body');
      expect(entries[1]).toHaveTextContent('entry-3-subject');
      expect(entries[1]).toHaveTextContent('entry-3-body');
      expect(entries[2]).toHaveTextContent('entry-4-subject');
      expect(entries[2]).toHaveTextContent('entry-4-body');
      expect(entries[3]).toHaveTextContent('entry-1-subject');
      expect(entries[3]).toHaveTextContent('entry-1-body');
    });
  });
});
