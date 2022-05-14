/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:8081/test/test-tag-1"}
 */

import '@testing-library/jest-dom';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import App from '../src/App';
import React from 'react';
import {Router} from 'react-router-dom';
import {createMemoryHistory} from 'history';
import entriesResponse from '../test/mocks/entries/entriesResponse';
import {rest} from 'msw';
import {setupServer} from 'msw/node';
import tagsResponse from '../test/mocks/tags/tagsResponse';
import userEvent from '@testing-library/user-event';

const response = {
  data: {
    type: 'TagTextEntryThroughModel',
    id: '5',
    attributes: {
      order: 1,
      date_updated: '2022-05-14T02:33:53.995003',
      date_created: '2022-05-14T02:33:53.994989',
    },
    relationships: {
      tag: {
        data: {
          type: 'test-tag-2',
          id: '2',
        },
      },
      text_entry: {
        data: {
          type: 'TextEntry',
          id: '1',
        },
      },
      user: {
        data: {
          type: 'User',
          id: '1',
        },
      },
    },
  },
  included: [],
};

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
  rest.post('http://localhost:9001/api/v1/tags_entries', (req, res, ctx) => {
    return res(
      ctx.delay(0),
      ctx.status(201, 'Mocked status'),
      ctx.json(response)
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Tag An Entry', () => {
  it('works', async () => {
    expect(window.location.href).toBe('http://localhost:8081/test/test-tag-1');
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    await act(async () => {
      const {rerender} = render(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      );
      await new Promise(res => setTimeout(res, 500));
      expect(history.location.pathname).toBe('/test/test-tag-1');
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

      ///
      const route2 = '/test/test-tag-2';
      history.push(route2);
      expect(history.location.pathname).toBe('/test/test-tag-2');
      rerender(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      );
      await new Promise(res => setTimeout(res, 500));
      let entry = screen.queryByText('entry-1-subject');
      expect(entry).not.toBeInTheDocument();

      ///
      const route3 = '/test/test-tag-1';
      history.push(route3);
      expect(history.location.pathname).toBe('/test/test-tag-1');
      rerender(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      );
      await new Promise(res => setTimeout(res, 500));
      entries = screen.getAllByRole('entry');
      expect(entries).toHaveLength(4);
      const user = userEvent.setup();
      const entryDragHandleContainers = screen.getAllByRole(
        'entryDragHandleContainer'
      );
      expect(entryDragHandleContainers).toHaveLength(4);
      await user.pointer({target: entryDragHandleContainers[0]});
      const tags = screen.getAllByRole('tag');
      expect(tags).toHaveLength(4);
      const entryDragHandle = screen.getByRole('entryDragHandle');
      fireEvent.dragStart(entryDragHandle);
      fireEvent.dragEnter(tags[1]);
      fireEvent.dragOver(tags[1]);
      await new Promise(res => setTimeout(res, 0));
      fireEvent.drop(tags[1]);
      ///
      const route4 = '/test/test-tag-2';
      history.push(route4);
      expect(history.location.pathname).toBe('/test/test-tag-2');
      rerender(
        <Router location={history.location} navigator={history}>
          <App />
        </Router>
      );
      await new Promise(res => setTimeout(res, 500));
      entry = screen.queryByText('entry-1-subject');
      expect(entry).toBeInTheDocument();
    });
  });
});
