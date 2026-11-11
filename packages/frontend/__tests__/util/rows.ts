import {isInaccessible} from '@testing-library/react';
import invariant from 'invariant';

export type RowKind = 'entry' | 'tag';

/** Data selectors with the same hidden-row exclusion as role queries. */
export function queryRows(kind: RowKind): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(`[data-row-kind="${kind}"]`)
  ).filter(row => !isInaccessible(row));
}

/** The accessible rows of this kind; like getAllByRole, requires a match. */
export function getRows(kind: RowKind): HTMLElement[] {
  const rows = queryRows(kind);
  invariant(rows.length > 0, `No accessible ${kind} rows found`);
  return rows;
}
