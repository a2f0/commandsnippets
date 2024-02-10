import '@testing-library/jest-dom';
import {MockInstance, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import React from 'react';
import TestAppRouter from './util/TestAppRouter';
import {assignLoggedInCookie} from './util/assignLoggedInCookie';
import {createMemoryHistory} from 'history';
import server from './util/msw';
import {tearleadsApi} from '../src/lib/api/tearleadsApi';
import userEvent from '@testing-library/user-event';

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
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
      fireEvent.dragEnter(tags[1]);
      fireEvent.dragOver(tags[1]);
      await new Promise(res => setTimeout(res, 1));
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: test-tag-1 index 0 moving to 1'
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
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
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
      fireEvent.drop(tags[0]);
    });
    expect(reorderTagSpy).not.toBeCalled();
    expect(consoleMock).toHaveBeenLastCalledWith(
      'useDrag end: it was not moved within the list.'
    );
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
    await user.pointer({target: tagDragHandleContainers[0]});
    const tagDragHandle = screen.getByRole('tagDragHandle');
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(tagDragHandle);
      fireEvent.dragEnter(tags[2]);
      fireEvent.dragOver(tags[2]);
      await new Promise(res => setTimeout(res, 0));
    });
    tags = screen.getAllByRole('tag');
    expect(tags).toHaveLength(4);
    expect(tags[0]).toHaveTextContent('test-tag-2');
    expect(tags[1]).toHaveTextContent('test-tag-3');
    expect(tags[2]).toHaveTextContent('test-tag-1');
    expect(tags[3]).toHaveTextContent('test-tag-4');

    // This is dropping it onto itself after reordering the list.
    // To my knowledge, this emulates what is going on in the screen in a real world scenario.
    await act(async () => {
      fireEvent.drop(tags[2]);
    });

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
});
