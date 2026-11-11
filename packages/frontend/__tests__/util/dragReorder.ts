import {act, fireEvent, isInaccessible, screen} from '@testing-library/react';
import type {UserEvent} from '@testing-library/user-event';
import invariant from 'invariant';
import {getRows, type RowKind} from './rows';

/**
 * Drag-and-drop on a sortable list (`components/dnd/`), whose rows have the
 * data-row-kind `kind` (`entry`, `tag`) and show a test-identified drag handle
 * (`${kind}DragHandle`) over their `${kind}DragHandleContainer`.
 */

/** Row `index` of `rows`, which must be there. */
export function rowAt(rows: HTMLElement[], index: number): HTMLElement {
  const row = rows[index];
  invariant(row, `row ${index} is undefined`);
  return row;
}

/** The list's rows, checked to read `labels` in that order. */
export function expectRows(
  kind: RowKind,
  labels: readonly string[]
): HTMLElement[] {
  const rows = getRows(kind);
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
  kind: RowKind,
  index: number,
  count: number
): Promise<HTMLElement> {
  const containers = screen
    .getAllByTestId(`${kind}DragHandleContainer`)
    .filter(container => !isInaccessible(container));
  expect(containers).toHaveLength(count);
  await user.pointer({target: rowAt(containers, index)});
  // Unlike role queries, test IDs include hidden handles: require only the
  // hovered one to be accessible, and explicitly assert its CSS visibility.
  const handles = screen
    .getAllByTestId(`${kind}DragHandle`)
    .filter(handle => !isInaccessible(handle));
  expect(handles).toHaveLength(1);
  const handle = rowAt(handles, 0);
  expect(handle).toBeVisible();
  return handle;
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
      await new Promise(resolve => {
        setTimeout(resolve, settleMs);
      });
    }
  });
}

export async function drop(row: HTMLElement): Promise<void> {
  await act(async () => {
    fireEvent.drop(row);
  });
}
