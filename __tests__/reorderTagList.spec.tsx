import '@testing-library/jest-dom';

import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {createMemoryHistory} from 'history';
import React from 'react';
import {type MockInstance, vi} from 'vitest';
import invariant from 'invariant';
import {tearleadsApi} from '../src/lib/api/tearleadsApi';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';
import server from './util/msw';
import TestAppRouter from './util/TestAppRouter';

Element.prototype.scrollIntoView = vi.fn();

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
beforeEach(() => assignLoggedInCookie());

describe('TagList', () => {
  let reorderTagSpy: MockInstance;
  let consoleMock: MockInstance;
  beforeEach(() => {
    reorderTagSpy = vi.spyOn(tearleadsApi, 'reorderTag');
    consoleMock = vi
      .spyOn(global.console, 'debug')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    reorderTagSpy.mockRestore();
    consoleMock.mockReset();
  });
  it('Hovers', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
    await waitFor(() => screen.getByText(/test-tag-1/i));
    await waitFor(() => screen.getByText(/test-tag-2/i));
    await waitFor(() => screen.getByText(/test-tag-3/i));
    await waitFor(() => screen.getByText(/test-tag-4/i));
    const tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-2');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');
    const tagDragHandleContainers = screen.getAllByRole(
      'tagDragHandleContainer'
    );
    expect(tagDragHandleContainers).toHaveLength(4);
    invariant(
      tagDragHandleContainers[0],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
    });

    await act(async () => {
      invariant(tags[0], 'tag is undefined');
      fireEvent.dragEnter(tags[0]);
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'hover: index 0 originalIndex 0'
    );
  });
  it('Reorders 0 -> 0', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
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
    invariant(
      tagDragHandleContainers[0],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
      invariant(tags[0], 'tag is undefined');
      fireEvent.dragEnter(tags[0]);
      fireEvent.dragOver(tags[0]);
      await new Promise(res => setTimeout(res, 0));
    });
    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-2');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    // This is dropping it onto itself after reordering the list.
    // To my knowledge, this emulates what is going on in the screen in a real world scenario.
    await act(async () => {
      invariant(tags[0], 'tag is undefined');
      fireEvent.drop(tags[0]);
    });
    expect(reorderTagSpy).not.toBeCalled();
    expect(consoleMock).toHaveBeenLastCalledWith(
      'useDrag end: it was not moved within the list.'
    );
  });
  it('Reorders 0 -> 1', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
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
    invariant(
      tagDragHandleContainers[0],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
    });

    await act(async () => {
      invariant(tags[1], 'tag is undefined');
      fireEvent.dragEnter(tags[1]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-1 index 0 moving to 1'
    );

    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-1');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(tags[1], 'tag is undefined');
      fireEvent.drop(tags[1]);
    });

    expect(reorderTagSpy).toBeCalledWith({
      data: {
        attributes: {
          top: '1',
          bottom: '3',
        },
        relationships: {},
        type: 'Tag',
      },
    });
  });

  it('Reorders 0 -> 2', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
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
    invariant(
      tagDragHandleContainers[0],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
    });

    await act(async () => {
      invariant(tags[1], 'tag is undefined');
      fireEvent.dragEnter(tags[1]);
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-1 index 0 moving to 1'
    );

    tags = screen.getAllByRole('tag');
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-1');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    await act(async () => {
      invariant(tags[2], 'tag is undefined');
      fireEvent.dragEnter(tags[2]);
    });
    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(tags[2], 'tag is undefined');
      fireEvent.drop(tags[2]);
    });

    tags = screen.getAllByRole('tag');
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-1');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    expect(reorderTagSpy).toBeCalledWith({
      data: {
        attributes: {
          top: '1',
          bottom: '4',
        },
        relationships: {},
        type: 'Tag',
      },
    });
  });
  it('Reorders 0 -> 3', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
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
    invariant(
      tagDragHandleContainers[0],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
    });
    await act(async () => {
      invariant(tags[1], 'tag is undefined');
      fireEvent.dragEnter(tags[1]);
      await new Promise(res => setTimeout(res, 1));
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-1 index 0 moving to 1'
    );

    tags = screen.getAllByRole('tag');
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-1');
    expect(tags[2]).toHaveTextContent('test-tag-3');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    await act(async () => {
      invariant(tags[2], 'tag is undefined');
      fireEvent.dragEnter(tags[2]);
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-1 index 1 moving to 2'
    );

    tags = screen.getAllByRole('tag');
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-1');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    await act(async () => {
      invariant(tags[3], 'tag is undefined');
      fireEvent.dragEnter(tags[3]);
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-1 index 2 moving to 3'
    );

    tags = screen.getAllByRole('tag');
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-4');
    expect(tags[3]).toHaveTextContent('test-tag-1');

    // This is dropping it onto itself after reordering the list.
    // To my knowledge, this emulates what is going on in the screen in a real world scenario.
    await act(async () => {
      invariant(tags[3], 'tag is undefined');
      fireEvent.drop(tags[3]);
    });

    tags = screen.getAllByRole('tag');
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-4');
    expect(tags[3]).toHaveTextContent('test-tag-1');

    expect(reorderTagSpy).toBeCalledWith({
      data: {
        attributes: {
          top: '4',
          bottom: '1',
        },
        relationships: {},
        type: 'Tag',
      },
    });
  });
  it('Reorders 1 -> 2', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
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
    invariant(
      tagDragHandleContainers[1],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[1]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
    });
    await act(async () => {
      invariant(tags[2], 'tag is undefined');
      fireEvent.dragEnter(tags[2]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-2 index 1 moving to 2'
    );

    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-2');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(tags[2], 'tag is undefined');
      fireEvent.drop(tags[2]);
    });
    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-2');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    expect(reorderTagSpy).toBeCalledWith({
      data: {
        attributes: {
          top: '2',
          bottom: '4',
        },
        relationships: {},
        type: 'Tag',
      },
    });
  });
  it('Reorders 2 -> 1', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test');
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
    invariant(
      tagDragHandleContainers[2],
      'tagDragHandleContainer is undefined'
    );
    await user.pointer({target: tagDragHandleContainers[2]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
    });
    await act(async () => {
      invariant(tags[1], 'tag is undefined');
      fireEvent.dragEnter(tags[1]);
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-3 index 2 moving to 1'
    );
    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-2');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(tags[1], 'tag is undefined');
      fireEvent.drop(tags[1]);
    });

    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-1');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-2');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    expect(reorderTagSpy).toBeCalledWith({
      data: {
        attributes: {
          top: '3',
          bottom: '2',
        },
        relationships: {},
        type: 'Tag',
      },
    });
  });
});
