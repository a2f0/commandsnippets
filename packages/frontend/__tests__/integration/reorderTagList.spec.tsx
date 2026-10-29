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

/** The names of the mock API's tags `numbers`, in that order. */
const names = (...numbers: number[]) =>
  numbers.map(number => `test-tag-${number}`);

/** The user's four tags, in their saved order, and a user to drag them. */
async function renderTags() {
  const user = userEvent.setup();
  const {history} = renderAppAt('/test/test');
  expect(history.location.pathname).toBe('/test/test');
  await waitFor(() => screen.getByText(/test-tag-1/i));
  await waitFor(() => screen.getByText(/test-tag-2/i));
  await waitFor(() => screen.getByText(/test-tag-3/i));
  await waitFor(() => screen.getByText(/test-tag-4/i));
  const tags = expectRows('tag', names(1, 2, 3, 4));
  return {user, tags};
}

interface Step {
  enter: number;
  /** Waits this long (a timer) after entering. */
  settleMs?: number;
  log?: string;
  order?: number[];
}

describe('TagList', () => {
  let reorderTagSpy: MockInstance;
  let consoleMock: MockInstance;
  beforeEach(() => {
    reorderTagSpy = vi.spyOn(apiClientMethods, 'reorderTag');
    consoleMock = vi
      .spyOn(global.console, 'debug')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    reorderTagSpy.mockRestore();
    consoleMock.mockReset();
  });
  it('Hovers', async () => {
    const {user, tags} = await renderTags();
    const handle = await pointAtHandle(user, 'tag', 0, 4);
    expect(reorderTagSpy).not.toBeCalled();
    await dragStart(handle);
    await dragEnter(rowAt(tags, 0));
    expect(consoleMock).toHaveBeenLastCalledWith(
      'hover: index 0 originalIndex 0'
    );
  });
  it('Reorders 0 -> 0', async () => {
    const {user, tags} = await renderTags();
    const handle = await pointAtHandle(user, 'tag', 0, 4);
    expect(reorderTagSpy).not.toBeCalled();
    await act(async () => {
      fireEvent.dragStart(handle);
      fireEvent.dragEnter(rowAt(tags, 0));
      fireEvent.dragOver(rowAt(tags, 0));
      await new Promise(res => setTimeout(res, 0));
    });
    const after = expectRows('tag', names(1, 2, 3, 4));
    // Dropping it onto itself, as the screen does in a real drag.
    await drop(rowAt(after, 0));
    expect(reorderTagSpy).not.toBeCalled();
    expect(consoleMock).toHaveBeenLastCalledWith(
      'useDrag end: it was not moved within the list.'
    );
  });

  // Each drag enters `steps` in turn (a step that moves the tag logs it),
  // then drops it on the row it entered last, which saves the move as the
  // tags above and below where it was dropped (`reorder`); the list then
  // reads `afterDrop`.
  it.each<{
    name: string;
    from: number;
    steps: Step[];
    afterDrop?: number[];
    reorder: {top: string; bottom: string};
  }>([
    {
      name: '0 -> 1',
      from: 0,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: test-tag-1 index 0 moving to 1',
          order: [2, 1, 3, 4],
        },
      ],
      reorder: {top: '1', bottom: '3'},
    },
    {
      // After the second enter and the drop on that row, the list still
      // reads as it did after the first enter.
      name: '0 -> 2',
      from: 0,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: test-tag-1 index 0 moving to 1',
          order: [2, 1, 3, 4],
        },
        {enter: 2},
      ],
      afterDrop: [2, 1, 3, 4],
      reorder: {top: '1', bottom: '4'},
    },
    {
      name: '0 -> 3',
      from: 0,
      steps: [
        {
          enter: 1,
          settleMs: 1,
          log: 'moveEntry: test-tag-1 index 0 moving to 1',
          order: [2, 1, 3, 4],
        },
        {
          enter: 2,
          log: 'moveEntry: test-tag-1 index 1 moving to 2',
          order: [2, 3, 1, 4],
        },
        {
          enter: 3,
          log: 'moveEntry: test-tag-1 index 2 moving to 3',
          order: [2, 3, 4, 1],
        },
      ],
      afterDrop: [2, 3, 4, 1],
      reorder: {top: '4', bottom: '1'},
    },
    {
      name: '1 -> 2',
      from: 1,
      steps: [
        {
          enter: 2,
          log: 'moveEntry: test-tag-2 index 1 moving to 2',
          order: [1, 3, 2, 4],
        },
      ],
      afterDrop: [1, 3, 2, 4],
      reorder: {top: '2', bottom: '4'},
    },
    {
      name: '2 -> 1',
      from: 2,
      steps: [
        {
          enter: 1,
          log: 'moveEntry: test-tag-3 index 2 moving to 1',
          order: [1, 3, 2, 4],
        },
      ],
      afterDrop: [1, 3, 2, 4],
      reorder: {top: '3', bottom: '2'},
    },
  ])('Reorders $name', async ({from, steps, afterDrop, reorder}) => {
    const {user, tags: initial} = await renderTags();
    const handle = await pointAtHandle(user, 'tag', from, 4);
    expect(reorderTagSpy).not.toBeCalled();
    await dragStart(handle);
    let tags = initial;
    let at = from;
    for (const step of steps) {
      await dragEnter(rowAt(tags, step.enter), step.settleMs);
      if (step.log !== undefined) {
        expect(consoleMock).toHaveBeenLastCalledWith(step.log);
      }
      if (step.order !== undefined) {
        tags = expectRows('tag', names(...step.order));
      }
      at = step.enter;
    }
    // Dropping it onto itself after reordering the list.
    await drop(rowAt(tags, at));
    if (afterDrop !== undefined) {
      expectRows('tag', names(...afterDrop));
    }
    await waitFor(() =>
      expect(reorderTagSpy).toBeCalledWith(
        {data: {attributes: reorder, relationships: {}, type: 'Tag'}},
        expect.any(String)
      )
    );
  });
});
