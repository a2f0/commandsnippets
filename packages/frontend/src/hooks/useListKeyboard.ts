import type {appMode} from '../lib/shared';
import {useAppState} from '../lib/state/appState';
import {useDocumentKeydown} from './useDocumentKeydown';

/** The keys a list takes from the page while it has the keyboard. */
const LIST_KEYS = ['ArrowUp', 'ArrowDown', 'Enter'];

interface ListKeyboard<Row extends {id: string}> {
  /** The app mode in which the list has the keyboard. */
  mode: appMode;
  rows: readonly Row[];
  selectedId: string | undefined;
  /** ArrowUp or ArrowDown chose the row at `index` (`up`: above). */
  onSelect: (row: Row, index: number, up: boolean) => void;
  /** Enter on the selected row. */
  onEnter: (row: Row) => void;
}

/**
 * The arrow keys move a list's selection and Enter acts on it, while the app
 * is in the list's mode. A key another listener has handled already (another
 * list, that changed the mode, or a menu) is left alone.
 */
export function useListKeyboard<Row extends {id: string}>({
  mode,
  rows,
  selectedId,
  onSelect,
  onEnter,
}: ListKeyboard<Row>): void {
  useDocumentKeydown(event => {
    if (event.defaultPrevented || useAppState.getState().appMode !== mode) {
      return;
    }
    if (LIST_KEYS.includes(event.code)) {
      event.preventDefault();
      event.stopPropagation();
    }
    const index = rows.findIndex(row => row.id === selectedId);
    const selected = rows[index];
    if (selected === undefined) {
      return;
    }
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const up = event.key === 'ArrowUp';
      const nextIndex = up ? index - 1 : index + 1;
      const next = rows[nextIndex];
      if (next !== undefined) {
        onSelect(next, nextIndex, up);
      }
    } else if (event.key === 'Enter') {
      onEnter(selected);
    }
  });
}
