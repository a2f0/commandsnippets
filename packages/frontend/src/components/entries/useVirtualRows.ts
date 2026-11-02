import type {TextEntry} from '@commandsnippets/api-shared';
import {type Theme, useTheme} from '@mui/material/styles';
import {
  defaultRangeExtractor,
  type Range,
  useWindowVirtualizer,
} from '@tanstack/react-virtual';
import {useCallback, useLayoutEffect, useMemo, useRef, useState} from 'react';
import {keyOfRow} from '../../lib/data/rowKey';
import {needsScrollingIntoView} from '../../lib/scroll';

/**
 * How many rows a list has before only those in view (and a few around
 * them) are rendered: rendering hundreds of rows at once makes a list slow
 * to open. A shorter list renders all of its rows.
 */
export const VIRTUALIZE_FROM = 100;

/** A row's height until it is measured. */
const ROW_ESTIMATE = 72;

/**
 * The rows rendered out of view too, by key: those with a form open, whose
 * text the row holds, and the one dragged, the drag's source. A row holds
 * itself with `keepRendered`, which returns its release.
 */
function useHeldRows(entries: readonly TextEntry[]) {
  const [held, setHeld] = useState<ReadonlySet<string>>(new Set());
  const keepRendered = useCallback((rowKey: string) => {
    setHeld(keys => new Set(keys).add(rowKey));
    return () =>
      setHeld(keys => {
        const rest = new Set(keys);
        rest.delete(rowKey);
        return rest;
      });
  }, []);
  const heldIndexes = useMemo(
    () =>
      held.size === 0
        ? []
        : entries.flatMap((entry, index) =>
            held.has(keyOfRow(entry)) ? [index] : []
          ),
    [entries, held]
  );
  const rangeExtractor = useCallback(
    (range: Range) => {
      const indexes = defaultRangeExtractor(range);
      const outOfView = heldIndexes.filter(index => !indexes.includes(index));
      return outOfView.length === 0
        ? indexes
        : [...indexes, ...outOfView].sort((a, b) => a - b);
    },
    [heldIndexes]
  );
  return {keepRendered, rangeExtractor};
}

/**
 * A long list (`VIRTUALIZE_FROM` rows or more) renders only the rows in
 * view, each measured, below where the list starts on the page; `scrollTo`
 * brings a row into view in a list of either length.
 */
export function useVirtualRows(entries: readonly TextEntry[]) {
  const theme: Theme = useTheme();
  const virtualized = entries.length >= VIRTUALIZE_FROM;
  // Each row's element, by entry id (for scrolling the selection into view).
  const rows = useRef(new Map<string, HTMLDivElement>());
  const list = useRef<HTMLDivElement | null>(null);
  const [listTop, setListTop] = useState(0);
  // Measured after every render: anything above the list can move it. Only
  // a long list measures.
  useLayoutEffect(() => {
    const top =
      !virtualized || list.current === null
        ? 0
        : list.current.getBoundingClientRect().top + window.scrollY;
    if (top !== listTop) {
      setListTop(top);
    }
  });
  const {keepRendered, rangeExtractor} = useHeldRows(entries);
  const virtualizer = useWindowVirtualizer({
    count: virtualized ? entries.length : 0,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 10,
    rangeExtractor,
    scrollMargin: listTop,
    // The app bar and the bottom bar cover the window's edges.
    scrollPaddingStart: theme.appBar.height,
    scrollPaddingEnd: theme.footer.height,
    getItemKey: index => {
      const entry = entries[index];
      return entry === undefined ? index : keyOfRow(entry);
    },
  });

  /** Bring the row at `index` into view, if it is not. */
  const scrollTo = useCallback(
    (index: number, entryId: string, block: 'start' | 'end') => {
      if (virtualized) {
        virtualizer.scrollToIndex(index, {align: 'auto'});
        return;
      }
      const elRef = {current: rows.current.get(entryId) ?? null};
      if (needsScrollingIntoView(elRef, theme)) {
        elRef.current?.scrollIntoView({behavior: 'auto', block});
      }
    },
    [virtualized, virtualizer, theme]
  );

  return {virtualized, virtualizer, list, rows, keepRendered, scrollTo};
}
