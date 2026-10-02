import type {TextEntry} from '@commandsnippets/api-shared';
import {Box} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import {useWindowVirtualizer} from '@tanstack/react-virtual';
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
import {useParams, useSearchParams} from 'react-router-dom';
import {
  useEntries,
  useReadOnly,
  useTagEntries,
  useTagNamed,
} from '../../lib/data/hooks';
import {sortEntries, sortTagEntries} from '../../lib/data/sort';
import {useTagSync} from '../../lib/data/useSync';
import {keyOfRow} from '../../lib/db/database';
import {needsScrollingIntoView} from '../../lib/scroll';
import {appMode, type IMouse, initialMouse} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
import {ItemTypes} from '../dnd/itemTypes';
import {Entry} from './Entry';
import {EntryListContextMenu} from './EntryListContextMenu';
import {EntryNew} from './EntryNew';

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

/**
 * The entries shown: a tag's (`/:user/:tag`), or all or the untagged ones
 * (`?entries=all`, `?entries=untagged`), from IndexedDB as syncs and writes
 * store them, sorted and searched. The tag shown syncs whenever it is not
 * synced through its revision. A long list renders only the rows in view
 * (`VIRTUALIZE_FROM`), as the window scrolls.
 */
const EntryList = () => {
  const appConfig = useAppConfig();
  // Another user's entries (staff reading them): no New Entry.
  const readOnly = useReadOnly();
  const {tag} = useParams();
  const theme: Theme = useTheme();
  const [searchParams] = useSearchParams();
  const entriesList = searchParams.get('entries');
  const listsAll = entriesList === 'all' || entriesList === 'untagged';

  const currentTag = useTagNamed(listsAll ? undefined : tag);
  useTagSync(currentTag);
  const tagged = useTagEntries(currentTag?.id);
  // (Nothing to read for a tag's list.)
  const listed = useEntries(
    listsAll ? (entriesList === 'all' ? 'all' : 'untagged') : null
  );
  const tagOrder = useAppState(
    state => state.tagTextEntryThroughModelSortOrder
  );
  const entryOrder = useAppState(state => state.entrySortOrder);
  const search = useAppState(state => state.entrySearchString);
  const shown = useMemo(() => {
    if (listsAll) {
      return listed === undefined
        ? undefined
        : sortEntries(listed, entryOrder, search);
    }
    return tagged === undefined
      ? undefined
      : sortTagEntries(tagged, tagOrder, search);
  }, [listsAll, listed, tagged, entryOrder, tagOrder, search]);

  // The list as the database has it now, rendered as soon as it is read: a
  // drag reorders a copy of it (`dragged`), which a newer list (the drop
  // stored) replaces.
  const [dragged, setDragged] = useState<{
    of: TextEntry[];
    entries: TextEntry[];
  } | null>(null);
  const entries = useMemo(
    () =>
      dragged !== null && dragged.of === shown
        ? dragged.entries
        : (shown ?? []),
    [dragged, shown]
  );
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
      list.current === null
        ? 0
        : list.current.getBoundingClientRect().top + window.scrollY;
    if (top !== listTop) {
      setListTop(top);
    }
  });
  const virtualizer = useWindowVirtualizer({
    count: virtualized ? entries.length : 0,
    estimateSize: () => ROW_ESTIMATE,
    overscan: 10,
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
            navigator.clipboard.writeText(selected.attributes.body);
            appConfig.setMostRecentCopyID(selected.id);
            appConfig.setMostRecentCopyType(selected.type);
          }
        }
      }
    },
    [appConfig, entries, scrollTo]
  );

  useEffect(() => {
    document.addEventListener('keydown', keyListener, false);

    return () => {
      document.removeEventListener('keydown', keyListener, false);
    };
  }, [keyListener]);

  const findEntry = useCallback(
    (id: string) => {
      const entry = entries.filter(c => c.id === id)[0];
      invariant(entry, 'entry is undefined');
      return {
        entry,
        index: entries.indexOf(entry),
      };
    },
    [entries]
  );

  const moveEntry = useCallback(
    (id: string, atIndex: number) => {
      const {entry, index} = findEntry(id);
      console.debug(
        `moveEntry: ${entry.attributes.subject} index ${index} moving to ${atIndex}`
      );
      const newEntries = [...entries];
      newEntries.splice(index, 1);
      newEntries.splice(atIndex, 0, entry);
      setDragged({of: shown ?? [], entries: newEntries});
    },
    [findEntry, entries, shown]
  );

  const findEntryByIndex = useCallback(
    (index: number): TextEntry | null => {
      if (index > entries.length - 1) {
        return null;
      }
      const entry = entries[index];
      invariant(entry, 'entry is undefined');
      return entry;
    },
    [entries]
  );

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});

  // Add this function to properly connect the drop ref
  const dropBoxRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    mouseData.mouseX = event.clientX - 2;
    mouseData.mouseY = event.clientY - 4;
    setMouse(mouseData);
  };

  const onMouseDown = () => {
    appConfig.setEntrySelectedID('');
  };

  const [mouse, setMouse] = useState(initialMouse);

  const contextMenu = useMemo(
    () => <EntryListContextMenu mouse={mouse} />,
    [mouse]
  );

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
        tagId={currentTag?.id}
        findEntryByIndex={findEntryByIndex}
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
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {appConfig.entryNew === 'textEntry-top' && !readOnly && (
        <EntryNew id="textEntryNewTop" tagId={currentTag?.id} />
      )}
      {virtualized ? (
        <div
          ref={list}
          style={{
            height: virtualizer.getTotalSize(),
            position: 'relative',
            width: '100%',
          }}
        >
          {virtualizer.getVirtualItems().map(item => {
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
          })}
        </div>
      ) : (
        entries.map((element, index) => renderRow(element, index))
      )}
      {appConfig.entryNew === 'textEntry-bottom' && !readOnly && (
        <EntryNew id="textEntryNewBottom" tagId={currentTag?.id} />
      )}
      <Box
        onContextMenu={readOnly ? undefined : handleContextClick}
        sx={{
          flexGrow: '1',
        }}
      />
      {appConfig.loggedInUser && !readOnly && <>{contextMenu}</>}
    </Box>
  );
};

const memoizedEntryList = React.memo(EntryList);

export {memoizedEntryList as EntryList};
