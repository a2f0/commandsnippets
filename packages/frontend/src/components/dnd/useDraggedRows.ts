import invariant from 'invariant';
import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';

/** A list's rows as drag and drop reorders them (`useSortableRow`). */
export interface DraggedRows<T> {
  /** The rows shown: the list given, or a drag's reordered copy of it. */
  rows: readonly T[];
  /** The row `id`, and where it is. */
  findEntry: (id: string) => {entry: T; index: number};
  /** The row at `index`, or null past either end. */
  findEntryByIndex: (index: number) => T | null;
  /** Move the row `id` to `atIndex`, in the copy a drag reorders. */
  moveEntry: (id: string, atIndex: number) => void;
}

const NO_ROWS: readonly never[] = [];

/**
 * The rows of `list` (the list as the database has it now, rendered as soon
 * as it is read) as a drag reorders them: a reordered copy of it, which a
 * newer list (the drop stored) replaces. The functions read the rows as
 * last rendered, so they stay the same as the list changes: new ones would
 * render every row again on every write. `nameOf` names a row in the debug
 * log.
 */
export function useDraggedRows<T extends {id: string}>(
  list: readonly T[] | undefined,
  nameOf: (row: T) => string
): DraggedRows<T> {
  const [dragged, setDragged] = useState<{
    of: readonly T[] | undefined;
    rows: readonly T[];
  } | null>(null);
  const rows = useMemo(
    () =>
      dragged !== null && dragged.of === list
        ? dragged.rows
        : (list ?? NO_ROWS),
    [dragged, list]
  );

  const rendered = useRef({list, rows, nameOf});
  useLayoutEffect(() => {
    rendered.current = {list, rows, nameOf};
  });

  const findEntry = useCallback((id: string) => {
    const {rows} = rendered.current;
    const index = rows.findIndex(row => row.id === id);
    const entry = rows[index];
    invariant(entry, `row ${id} is not listed`);
    return {entry, index};
  }, []);

  const findEntryByIndex = useCallback(
    (index: number): T | null => rendered.current.rows[index] ?? null,
    []
  );

  const moveEntry = useCallback(
    (id: string, atIndex: number) => {
      const {list, rows, nameOf} = rendered.current;
      const {entry, index} = findEntry(id);
      console.debug(
        `moveEntry: ${nameOf(entry)} index ${index} moving to ${atIndex}`
      );
      const moved = [...rows];
      moved.splice(index, 1);
      moved.splice(atIndex, 0, entry);
      setDragged({of: list, rows: moved});
    },
    [findEntry]
  );

  return {rows, findEntry, findEntryByIndex, moveEntry};
}
