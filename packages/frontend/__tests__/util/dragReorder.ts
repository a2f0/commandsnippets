import {act, fireEvent, screen} from '@testing-library/react';
import type {UserEvent} from '@testing-library/user-event';
import invariant from 'invariant';

/**
 * Drag-and-drop on a sortable list (`components/dnd/`), whose rows have the
 * role `role` (`entry`, `tag`) and show a drag handle (`${role}DragHandle`)
 * while the pointer is over their `${role}DragHandleContainer`.
 */

/** Row `index` of `rows`, which must be there. */
export function rowAt(rows: HTMLElement[], index: number): HTMLElement {
  const row = rows[index];
  invariant(row, `row ${index} is undefined`);
  return row;
}

/** The list's rows, checked to read `labels` in that order. */
export function expectRows(
  role: string,
  labels: readonly string[]
): HTMLElement[] {
  const rows = screen.getAllByRole(role);
  expect(rows).toHaveLength(labels.length);
  labels.forEach((label, index) => {
    expect(rows[index]).toHaveTextContent(label);
  });
  return rows;
}

/**
 * Points at row `index`'s handle container (one for each of the `count`
 * rows) and returns the drag handle that shows.
 */
export async function pointAtHandle(
  user: UserEvent,
  role: string,
  index: number,
  count: number
): Promise<HTMLElement> {
  const containers = screen.getAllByRole(`${role}DragHandleContainer`);
  expect(containers).toHaveLength(count);
  await user.pointer({target: rowAt(containers, index)});
  return screen.getByRole(`${role}DragHandle`);
}

export async function dragStart(handle: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.dragStart(handle);
  });
}

/** Drags over `row`, then waits `settleMs` (a timer) when given. */
export async function dragEnter(
  row: HTMLElement,
  settleMs?: number
): Promise<void> {
  await act(async () => {
    fireEvent.dragEnter(row);
    if (settleMs !== undefined) {
      await new Promise(resolve => setTimeout(resolve, settleMs));
    }
  });
}

export async function drop(row: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.drop(row);
  });
}
