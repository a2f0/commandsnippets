import {act, fireEvent, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {type MockInstance, vi} from 'vitest';
import {apiClientMethods} from '../util/apiClientMethods';
import {assignLoggedInCookie} from '../util/assignLoggedInCookie';
import {
  dragEnter,
  dragStart,
  drop,
  expectRows,
  pointAtHandle,
  rowAt,
} from '../util/dragReorder';
import {serveMockApi} from '../util/msw';
import {signIn} from '../util/signIn';
import {renderAppAt} from '../util/TestAppRouter';

serveMockApi();
beforeEach(() => {
  signIn();
  assignLoggedInCookie();
});

/** The subjects of the mock API's entries `numbers`, in that order. */
const subjects = (...numbers: number[]) =>
  numbers.map(number => `entry-${number}-subject`);

/** The tag's four entries, in their saved order, and a user to drag them. */
async function renderEntries() {
  const user = userEvent.setup();
  const {history} = renderAppAt('/test/test-tag-1');
  expect(history.location.pathname).toBe('/test/test-tag-1');
  await waitFor(() => screen.getByText(/entry-1-subject/i));
  await waitFor(() => screen.getByText(/entry-1-body/i));
  await waitFor(() => screen.getByText(/entry-2-subject/i));
  await waitFor(() => screen.getByText(/entry-2-body/i));
  const entries = expectRows('entry', subjects(1, 2, 3, 4));
  entries.forEach((entry, index) => {
    expect(entry).toHaveTextContent(`entry-${index + 1}-body`);
  });
  return {user, entries};
}

describe('Entries List', () => {
  let reorderEntrySpy: MockInstance;
  let consoleMock: MockInstance;
  beforeEach(() => {
    reorderEntrySpy = vi.spyOn(apiClientMethods, 'reorderEntry');
    consoleMock = vi
      .spyOn(global.console, 'debug')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    reorderEntrySpy.mockRestore();
    consoleMock.mockReset();
  });
  it('Hovers', async () => {
    const {user, entries} = await renderEntries();
    const handle = await pointAtHandle(user, 'entry', 0, 4);
    expect(reorderEntrySpy).not.toBeCalled();
    await dragStart(handle);
    await dragEnter(rowAt(entries, 0));
    expect(consoleMock).toHaveBeenLastCalledWith(
      'hover: index 0 originalIndex 0'
    );
  });
  it('Reorders 0 -> 0', async () => {
    const {user, entries} = await renderEntries();
    const handle = await pointAtHandle(user, 'entry', 0, 4);
    expect(reorderEntrySpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(handle);
      fireEvent.dragEnter(rowAt(entries, 0));
      fireEvent.dragOver(rowAt(entries, 0));
      await new Promise(res => setTimeout(res, 0));
    });
    const after = expectRows('entry', subjects(1, 2, 3, 4));
    // Dropping it onto itself, as the screen does in a real drag.
    await drop(rowAt(after, 0));
    expect(reorderEntrySpy).not.toBeCalled();
    expect(consoleMock).toHaveBeenLastCalledWith(
      'useDrag end: it was not moved within the list.'
    );
  });

  // Each drag enters `steps` in turn (each moving the entry one place, which
  // it logs), then drops it where it ended up, which saves the move as the
  // entries now above and below it (`reorder`).
  it.each([
    {
      name: '0 -> 1',
      from: 0,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: entry-1-subject index 0 moving to 1',
          order: [2, 1, 3, 4],
        },
      ],
      reorder: ['1', '3'],
    },
    {
      name: '0 -> 2',
      from: 0,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: entry-1-subject index 0 moving to 1',
          order: [2, 1, 3, 4],
        },
        {
          enter: 2,
          log: 'moveEntry: entry-1-subject index 1 moving to 2',
          order: [2, 3, 1, 4],
        },
      ],
      reorder: ['1', '4'],
    },
    {
      name: '0 -> 3',
      from: 0,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: entry-1-subject index 0 moving to 1',
          order: [2, 1, 3, 4],
        },
        {
          enter: 2,
          log: 'moveEntry: entry-1-subject index 1 moving to 2',
          order: [2, 3, 1, 4],
        },
        {
          enter: 3,
          log: 'moveEntry: entry-1-subject index 2 moving to 3',
          order: [2, 3, 4, 1],
        },
      ],
      reorder: ['4', '1'],
    },
    {
      name: '1 -> 2',
      from: 1,
      steps: [
        {
          enter: 2,
          log: 'moveEntry: entry-2-subject index 1 moving to 2',
          order: [1, 3, 2, 4],
        },
      ],
      reorder: ['2', '4'],
    },
    {
      name: '2 -> 1',
      from: 2,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: entry-3-subject index 2 moving to 1',
          order: [1, 3, 2, 4],
        },
      ],
      reorder: ['3', '2'],
    },
  ])('Reorders $name', async ({from, steps, reorder}) => {
    const {user, entries: initial} = await renderEntries();
    const handle = await pointAtHandle(user, 'entry', from, 4);
    expect(reorderEntrySpy).not.toBeCalled();
    await dragStart(handle);
    let entries = initial;
    let at = from;
    for (const step of steps) {
      await dragEnter(rowAt(entries, step.enter));
      expect(consoleMock).toHaveBeenLastCalledWith(step.log);
      entries = expectRows('entry', subjects(...step.order));
      at = step.enter;
    }
    // Dropping it onto itself after reordering the list.
    await drop(rowAt(entries, at));
    // The reorder reads the junctions from IndexedDB first.
    await waitFor(() =>
      expect(reorderEntrySpy).toBeCalledWith(...reorder, expect.any(String))
    );
  });
});
