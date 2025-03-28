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

describe('Entries List', () => {
  let reorderEntrySpy: MockInstance;
  let consoleMock: MockInstance;
  beforeEach(() => {
    reorderEntrySpy = vi.spyOn(tearleadsApi, 'reorderEntry');
    consoleMock = vi
      .spyOn(global.console, 'debug')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    reorderEntrySpy.mockRestore();
    consoleMock.mockReset();
  });
  it('Hovers', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
    const entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-1-subject');
    expect(entries[0]).toHaveTextContent('entry-1-body');
    expect(entries[1]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-2-body');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-3-body');
    expect(entries[3]).toHaveTextContent('entry-4-subject');
    expect(entries[3]).toHaveTextContent('entry-4-body');
    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    invariant(
      entryDragHandleContainers[0],
      'entryDragHandleContainer is undefined'
    );
    await user.pointer({target: entryDragHandleContainers[0]});
    const entryDragHandle = screen.getByRole('entryDragHandle');
    expect(reorderEntrySpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
    });

    await act(async () => {
      invariant(entries[0], 'entry is undefined');
      fireEvent.dragEnter(entries[0]);
    });
    expect(consoleMock).toHaveBeenLastCalledWith(
      'hover: index 0 originalIndex 0'
    );
  });
  it('Reorders 0 -> 0', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/test-tag-1/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/test-tag-2/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/test-tag-3/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/test-tag-4/i), {timeout: 3000});
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

    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    invariant(
      entryDragHandleContainers[0],
      'entryDragHandleContainer is undefined'
    );

    await user.pointer({target: entryDragHandleContainers[0]});
    const entryDragHandle = screen.getByRole('entryDragHandle');
    expect(reorderEntrySpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
      invariant(entries[0], 'entry is undefined');
      fireEvent.dragEnter(entries[0]);
      fireEvent.dragOver(entries[0]);
      await new Promise(res => setTimeout(res, 0));
    });
    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-1-subject');
    expect(entries[0]).toHaveTextContent('entry-1-body');
    expect(entries[1]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-2-body');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-3-body');
    expect(entries[3]).toHaveTextContent('entry-4-subject');
    expect(entries[3]).toHaveTextContent('entry-4-body');

    // This is dropping it onto itself after reordering the list.
    // To my knowledge, this emulates what is going on in the screen in a real world scenario.
    await act(async () => {
      invariant(entries[0], 'entry is undefined');
      fireEvent.drop(entries[0]);
    });
    expect(reorderEntrySpy).not.toBeCalled();
    expect(consoleMock).toHaveBeenLastCalledWith(
      'useDrag end: it was not moved within the list.'
    );
  });
  it('Reorders 0 -> 1', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
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
    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    invariant(
      entryDragHandleContainers[0],
      'entryDragHandleContainer is undefined'
    );
    await user.pointer({target: entryDragHandleContainers[0]});
    const entryDragHandle = screen.getByRole('entryDragHandle');
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
    });

    await act(async () => {
      invariant(entries[1], 'entry is undefined');
      fireEvent.dragEnter(entries[1]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: entry-1-subject index 0 moving to 1'
    );

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-1-subject');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[3]).toHaveTextContent('entry-4-subject');

    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(entries[1], 'entry is undefined');
      fireEvent.drop(entries[1]);
    });

    expect(reorderEntrySpy).toBeCalledWith('1', '3');
  });
  it('Reorders 0 -> 2', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
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
    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    invariant(
      entryDragHandleContainers[0],
      'entryDragHandleContainer is undefined'
    );
    await user.pointer({target: entryDragHandleContainers[0]});
    const entryDragHandle = screen.getByRole('entryDragHandle');
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
    });

    await act(async () => {
      invariant(entries[1], 'entry is undefined');
      fireEvent.dragEnter(entries[1]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: entry-1-subject index 0 moving to 1'
    );

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-1-subject');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[3]).toHaveTextContent('entry-4-subject');

    await act(async () => {
      invariant(entries[2], 'entry is undefined');
      fireEvent.dragEnter(entries[2]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: entry-1-subject index 1 moving to 2'
    );

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-1-subject');
    expect(entries[3]).toHaveTextContent('entry-4-subject');

    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(entries[2], 'entry is undefined');
      fireEvent.drop(entries[2]);
    });

    expect(reorderEntrySpy).toBeCalledWith('1', '4');
  });
  it('Reorders 0 -> 3', async () => {
    const user = userEvent.setup();
    const history = createMemoryHistory();
    const route = '/test/test-tag-1';
    history.push(route);
    render(<TestAppRouter history={history} />);
    expect(history.location.pathname).toBe('/test/test-tag-1');
    await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
    await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
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
    const entryDragHandleContainers = screen.getAllByRole(
      'entryDragHandleContainer'
    );
    expect(entryDragHandleContainers).toHaveLength(4);
    invariant(
      entryDragHandleContainers[0],
      'entryDragHandleContainer is undefined'
    );
    await user.pointer({target: entryDragHandleContainers[0]});
    const entryDragHandle = screen.getByRole('entryDragHandle');
    await act(async () => {
      fireEvent.dragStart(entryDragHandle);
    });

    await act(async () => {
      invariant(entries[1], 'entry is undefined');
      fireEvent.dragEnter(entries[1]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: entry-1-subject index 0 moving to 1'
    );

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-1-subject');
    expect(entries[2]).toHaveTextContent('entry-3-subject');
    expect(entries[3]).toHaveTextContent('entry-4-subject');

    await act(async () => {
      invariant(entries[2], 'entry is undefined');
      fireEvent.dragEnter(entries[2]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: entry-1-subject index 1 moving to 2'
    );

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-1-subject');
    expect(entries[3]).toHaveTextContent('entry-4-subject');

    await act(async () => {
      invariant(entries[3], 'entry is undefined');
      fireEvent.dragEnter(entries[3]);
    });

    expect(consoleMock).toHaveBeenLastCalledWith(
      'moveEntry: entry-1-subject index 2 moving to 3'
    );

    entries = screen.getAllByRole('entry');
    expect(entries).toHaveLength(4);
    expect(entries[0]).toHaveTextContent('entry-2-subject');
    expect(entries[1]).toHaveTextContent('entry-3-subject');
    expect(entries[2]).toHaveTextContent('entry-4-subject');
    expect(entries[3]).toHaveTextContent('entry-1-subject');

    // This is dropping it onto itself after reordering the list.
    await act(async () => {
      invariant(entries[3], 'entry is undefined');
      fireEvent.drop(entries[3]);
    });

    expect(reorderEntrySpy).toBeCalledWith('4', '1');
  });

  // it('Reorders', async () => {
  //   const user = userEvent.setup();
  //   const history = createMemoryHistory();
  //   const route = '/test/test-tag-1';
  //   history.push(route);
  //   render(<TestAppRouter history={history} />);
  //   expect(history.location.pathname).toBe('/test/test-tag-1');
  //   await waitFor(() => screen.getByText(/entry-1-subject/i), {timeout: 3000});
  //   await waitFor(() => screen.getByText(/entry-1-body/i), {timeout: 3000});
  //   await waitFor(() => screen.getByText(/entry-2-subject/i), {timeout: 3000});
  //   await waitFor(() => screen.getByText(/entry-2-body/i), {timeout: 3000});
  //   let entries = screen.getAllByRole('entry');
  //   expect(entries).toHaveLength(4);
  //   expect(entries[0]).toHaveTextContent('entry-1-subject');
  //   expect(entries[0]).toHaveTextContent('entry-1-body');
  //   expect(entries[1]).toHaveTextContent('entry-2-subject');
  //   expect(entries[1]).toHaveTextContent('entry-2-body');
  //   expect(entries[2]).toHaveTextContent('entry-3-subject');
  //   expect(entries[2]).toHaveTextContent('entry-3-body');
  //   expect(entries[3]).toHaveTextContent('entry-4-subject');
  //   expect(entries[3]).toHaveTextContent('entry-4-body');
  //   const entryDragHandleContainers = screen.getAllByRole(
  //     'entryDragHandleContainer'
  //   );
  //   expect(entryDragHandleContainers).toHaveLength(4);
  //   invariant(
  //     entryDragHandleContainers[0],
  //     'entryDragHandleContainer is undefined'
  //   );
  //   await user.pointer({target: entryDragHandleContainers[0]});
  //   const entryDragHandle = screen.getByRole('entryDragHandle');
  //   expect(reorderEntrySpy).not.toBeCalled();
  //   await act(async () => {
  //     fireEvent.dragStart(entryDragHandle);
  //     invariant(entries[2], 'entry is undefined');
  //     invariant(entries[3], 'entry is undefined');
  //     fireEvent.dragEnter(entries[2]);
  //     fireEvent.dragOver(entries[2]);
  //     await new Promise(res => setTimeout(res, 0));
  //     fireEvent.drop(entries[3]);
  //   });
  //   entries = screen.getAllByRole('entry');
  //   expect(entries).toHaveLength(4);
  //   expect(entries[0]).toHaveTextContent('entry-2-subject');
  //   expect(entries[0]).toHaveTextContent('entry-2-body');
  //   expect(entries[1]).toHaveTextContent('entry-3-subject');
  //   expect(entries[1]).toHaveTextContent('entry-3-body');
  //   expect(entries[2]).toHaveTextContent('entry-4-subject');
  //   expect(entries[2]).toHaveTextContent('entry-4-body');
  //   expect(entries[3]).toHaveTextContent('entry-1-subject');
  //   expect(entries[3]).toHaveTextContent('entry-1-body');
  //   expect(reorderEntrySpy).toBeCalledWith('3', '1');
  // });
});
