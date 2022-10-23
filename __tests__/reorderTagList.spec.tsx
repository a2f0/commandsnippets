/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "http://localhost:8081/test/test-tag-1"}
 */

import '@testing-library/jest-dom';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import TestAppRouter from './util/TestAppRouter';
import {assignLoggedInCookie} from './util';
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
  rest.post('http://localhost:9001/api/v1/tags/reorder', (req, res, ctx) => {
    return res(
      ctx.delay(0),
      ctx.status(200, 'Mocked status'),
      ctx.json({data: null})
    );
  })
);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('TagList', () => {
  it('Reorders', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    expect(window.location.href).toBe('http://localhost:8081/test/test-tag-1');
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    await waitFor(() => screen.getByText(/test-tag-1/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/test-tag-2/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/test-tag-3/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/test-tag-4/i), {timeout: 3000});
    let tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-2');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');
    const tagDragHandleContainers = screen.getAllByRole(
      'tagDragHandleContainer'
    );
    expect(tagDragHandleContainers).toHaveLength(4);
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
      fireEvent.dragEnter(tags[2]);
      fireEvent.dragOver(tags[2]);
      await new Promise(res => setTimeout(res, 0));
      fireEvent.drop(tags[3]);
    });
    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-4');
    expect(tags[3]).toHaveTextContent('test-tag-1');
  });
});
