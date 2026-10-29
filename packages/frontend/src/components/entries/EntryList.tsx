import type {TextEntry} from '@commandsnippets/api-shared';
import {Box} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import {
  defaultRangeExtractor,
  type Range,
  useWindowVirtualizer,
} from '@tanstack/react-virtual';
import invariant from 'invariant';
import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useDrop} from 'react-dnd';
import {useContextMenu} from '../../hooks/useContextMenu';
import {copyEntry} from '../../lib/data/copyEntry';
import {NO_TAG_NAMES} from '../../lib/data/entryTags';
import {
  useEntries,
  useEntryTagNames,
  useReadOnly,
  useSession,
  useTagEntries,
  useTagNamed,
} from '../../lib/data/hooks';
import {sortEntries, sortTagEntries} from '../../lib/data/sort';
import {useTagSync} from '../../lib/data/useSync';
import {keyOfRow} from '../../lib/db/database';
import {useRenderTiming} from '../../lib/metrics/hooks';
import {listKey, listShown} from '../../lib/metrics/timings';
import {useRouteParam, useSearchParam} from '../../lib/router/navigation';
import {needsScrollingIntoView} from '../../lib/scroll';
import {appMode} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
import {ItemTypes} from '../dnd/itemTypes';
import {useDraggedRows} from '../dnd/useDraggedRows';
import {Entry} from './Entry';
import {EntryListContextMenu} from './EntryListContextMenu';
import {EntryNew} from './EntryNew';
import {keepUnchanged} from './unchangedRows';

export interface IParamTypes {
  user: string;
  tag: string;
}

/**
 * How many rows a list has before only those in view (and a few around
 * them) are rendered: rendering hundreds of rows at once makes a list slow
 * to open. A shorter list renders all of its rows.
 */
export const VIRTUALIZE_FROM = 100;

/** A row's height until it is measured. */
const ROW_ESTIMATE = 72;

const subjectOf = (entry: TextEntry) => entry.attributes.subject;

/**
 * The entries shown: a tag's (`/:user/:tag`), or all or the untagged ones
 * (`?entries=all`, `?entries=untagged`), from IndexedDB as syncs and writes
 * store them, sorted and searched. The tag shown syncs whenever it is not
 * synced through its revision. A long list renders only the rows in view
 * (`VIRTUALIZE_FROM`), as the window scrolls. Each render is timed for the
 * HUD, and the list's first render with its own rows ends the interaction
 * that asked for it (`listShown`).
 */
const EntryList = () => {
  const renderStart = performance.now();
  const appConfig = useAppConfig();
  // Another user's entries (staff reading them): no New Entry.
  const readOnly = useReadOnly();
  // Whose entries a copy (Enter) counts a reuse of: none but the owner's.
  const session = useSession();
  const tag = useRouteParam('tag');
  const theme: Theme = useTheme();
  const entriesList = useSearchParam('entries');
  const listsAll = entriesList === 'all' || entriesList === 'untagged';

  const named = useTagNamed(listsAll ? undefined : tag);
  const currentTag = named?.tag;
  useTagSync(currentTag);
  const tagged = useTagEntries(currentTag?.id);
  // (Nothing to read for a tag's list.)
  const listed = useEntries(
    listsAll ? (entriesList === 'all' ? 'all' : 'untagged') : null
  );
  // The tags shown under each entry: all of its tags, but the one the rows
  // are of in a tag's list.
  const tagNames = useEntryTagNames(listsAll ? undefined : tagged?.tagId);
  const tagOrder = useAppState(
    state => state.tagTextEntryThroughModelSortOrder
  );
  const entryOrder = useAppState(state => state.entrySortOrder);
  const search = useAppState(state => state.entrySearchString);
  // The rows last shown, by key: an entry that the next read (a write's,
  // which reads every row again) finds unchanged keeps its object, so only
  // the rows the write changed render again.
  const lastShown = useRef<ReadonlyMap<string, TextEntry>>(new Map());
  const shown = useMemo(() => {
    const sorted = listsAll
      ? listed === undefined
        ? undefined
        : sortEntries(listed.entries, entryOrder, search)
      : tagged === undefined
        ? undefined
        : sortTagEntries(tagged.entries, tagOrder, search);
    return sorted === undefined
      ? undefined
      : keepUnchanged(sorted, lastShown.current, keyOfRow);
  }, [listsAll, listed, tagged, entryOrder, tagOrder, search]);
  useLayoutEffect(() => {
    lastShown.current = new Map(
      (shown ?? []).map(entry => [keyOfRow(entry), entry])
    );
  }, [shown]);
  // The list asked for, with its own rows: not the last list's, which the
  // queries answer with until they read the next.
  const shownList = listsAll
    ? listKey({entries: entriesList ?? ''})
    : listKey({tag: tag ?? ''});
  const ownRows = listsAll
    ? listed?.which === entriesList
    : named !== undefined &&
      named.name === tag &&
      tagged?.tagId === named.tag?.id;
  useLayoutEffect(() => {
    if (ownRows) {
      listShown(shownList);
    }
  }, [ownRows, shownList]);

  // The list as a drag reorders it.
  const {
    rows: entries,
    findEntry,
    findEntryByIndex,
    moveEntry,
  } = useDraggedRows(shown, subjectOf);
  useEffect(() => {
    const [first] = shown ?? [];
    if (
      first !== undefined &&
      !shown?.some(entry => entry.id === appConfig.entrySelectedID)
    ) {
      appConfig.setEntrySelectedID(first.id);
    }
  }, [shown, appConfig]);

  // Each row's element, by entry id (for scrolling the selection into view).
  const rows = useRef(new Map<string, HTMLDivElement>());

  // A long list: only the rows in view are rendered, each measured, below
  // where the list starts on the page (`listTop`).
  const virtualized = entries.length >= VIRTUALIZE_FROM;
  const list = useRef<HTMLDivElement | null>(null);
  const [listTop, setListTop] = useState(0);
  useLayoutEffect(() => {
    const top =
      !virtualized || list.current === null
        ? 0
        : list.current.getBoundingClientRect().top + window.scrollY;
    if (top !== listTop) {
      setListTop(top);
    }
  });
  // The rows rendered out of view too, by key: those with a form open, whose
  // text the row holds, and the one dragged, the drag's source.
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

  const keyListener = useCallback(
    (event: KeyboardEvent) => {
      const trappedKeyCodes = ['Enter', 'ArrowUp', 'ArrowDown'];
      if (
        trappedKeyCodes.includes(event.code) &&
        appConfig.appMode === appMode.entriesList
      ) {
        event.preventDefault();
        event.stopPropagation();
      }
      const selected = entries.find(c => c.id === appConfig.entrySelectedID);
      if (selected !== undefined && appConfig.appMode === appMode.entriesList) {
        const selectedIndex = entries.indexOf(selected);
        if (selectedIndex !== -1) {
          if (event.key === 'ArrowUp') {
            const newIndex = selectedIndex - 1;
            if (newIndex >= 0) {
              const entry = entries[newIndex];
              if (entry) {
                appConfig.setEntrySelectedID(entry.id);
                scrollTo(newIndex, entry.id, 'start');
              }
            }
          } else if (event.key === 'ArrowDown') {
            const newIndex = selectedIndex + 1;
            if (newIndex <= entries.length - 1) {
              const entry = entries[newIndex];
              invariant(entry, 'entry is undefined');
              appConfig.setEntrySelectedID(entry.id);
              scrollTo(newIndex, entry.id, 'end');
            }
          } else if (event.key === 'Enter') {
            copyEntry(session, selected.id, selected.attributes.body);
            appConfig.setMostRecentCopyID(selected.id);
          }
        }
      }
    },
    [appConfig, entries, scrollTo, session]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  // Add this function to properly connect the drop ref
  const dropBoxRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  const onMouseDown = () => {
    appConfig.setEntrySelectedID('');
  };

  const menu = useContextMenu();

  useRenderTiming('EntryList', renderStart, `${entries.length} rows`);

  /** The row of `element`, at `index` (measured and placed, in a long list). */
  const renderRow = (
    element: TextEntry,
    index: number,
    placed?: {
      measure: (node: HTMLDivElement | null) => void;
      style: React.CSSProperties;
    }
  ) => (
    // Keyed so a row made here stays the same component (an open editor
    // and its text too) when the API's id replaces its own.
    <div
      key={keyOfRow(element)}
      data-index={index}
      style={placed?.style}
      ref={node => {
        placed?.measure(node);
        if (node === null) {
          rows.current.delete(element.id);
        } else {
          rows.current.set(element.id, node);
        }
      }}
    >
      <Entry
        id={element.id}
        index={index}
        moveEntry={moveEntry}
        findEntry={findEntry}
        object={element}
        rowKey={keyOfRow(element)}
        // The tag the rows are of, read with them: the last tag's while the
        // next tag's are read (its rows render again only once they are),
        // and none in the all or untagged list.
        tagId={listsAll ? undefined : tagged?.tagId}
        tagNames={tagNames.get(element.id) ?? NO_TAG_NAMES}
        findEntryByIndex={findEntryByIndex}
        keepRendered={keepRendered}
      />
    </div>
  );

  return (
    <Box
      ref={dropBoxRef}
      id="tagsEntriesList"
      onMouseDown={onMouseDown}
      sx={{
        flexGrow: '1',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {appConfig.entryNew === 'textEntry-top' && !readOnly && (
        <EntryNew id="textEntryNewTop" tagId={currentTag?.id} />
      )}
      {/* One parent for the rows, however many there are: a list that
          grows or shrinks past `VIRTUALIZE_FROM` keeps its rows (and their
          forms) rendered as they were. */}
      <div
        ref={list}
        style={
          virtualized
            ? {
                height: virtualizer.getTotalSize(),
                position: 'relative',
                width: '100%',
              }
            : undefined
        }
      >
        {virtualized
          ? virtualizer.getVirtualItems().map(item => {
              const element = entries[item.index];
              return element === undefined
                ? null
                : renderRow(element, item.index, {
                    measure: virtualizer.measureElement,
                    style: {
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${item.start - virtualizer.options.scrollMargin}px)`,
                    },
                  });
            })
          : entries.map((element, index) => renderRow(element, index))}
      </div>
      {appConfig.entryNew === 'textEntry-bottom' && !readOnly && (
        <EntryNew id="textEntryNewBottom" tagId={currentTag?.id} />
      )}
      <Box
        onContextMenu={readOnly ? undefined : menu.onContextMenu}
        sx={{
          flexGrow: '1',
        }}
      />
      {appConfig.loggedInUser && !readOnly && (
        <EntryListContextMenu mouse={menu.mouse} onClose={menu.close} />
      )}
    </Box>
  );
};

const memoizedEntryList = React.memo(EntryList);

export {memoizedEntryList as EntryList};
