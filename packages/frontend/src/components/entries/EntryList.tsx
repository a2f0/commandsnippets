import type {TextEntry} from '@commandsnippets/api-shared';
import {Box} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {useTheme} from '@mui/material/styles';
import invariant from 'invariant';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
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
 * The entries shown: a tag's (`/:user/:tag`), or all or the untagged ones
 * (`?entries=all`, `?entries=untagged`), from IndexedDB as syncs and writes
 * store them, sorted and searched. The tag shown syncs whenever it is not
 * synced through its revision.
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
  const rowOf = (entryId: string | undefined) => ({
    current: entryId === undefined ? null : (rows.current.get(entryId) ?? null),
  });

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
                const elRef = rowOf(entry.id);
                if (needsScrollingIntoView(elRef, theme)) {
                  elRef.current?.scrollIntoView({
                    behavior: 'auto',
                    block: 'start',
                  });
                }
              }
            }
          } else if (event.key === 'ArrowDown') {
            const newIndex = selectedIndex + 1;
            if (newIndex <= entries.length - 1) {
              const entry = entries[newIndex];
              invariant(entry, 'entry is undefined');
              appConfig.setEntrySelectedID(entry.id);
              const elRef = rowOf(entry.id);
              if (needsScrollingIntoView(elRef, theme)) {
                elRef.current?.scrollIntoView({
                  behavior: 'auto',
                  block: 'end',
                });
              }
            }
          } else if (event.key === 'Enter') {
            navigator.clipboard.writeText(selected.attributes.body);
            appConfig.setMostRecentCopyID(selected.id);
            appConfig.setMostRecentCopyType(selected.type);
          }
        }
      }
    },
    [appConfig, entries, theme]
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
      {entries.map((element, i) => {
        const index = i;
        return (
          // Keyed so a row made here stays the same component (an open
          // editor and its text too) when the API's id replaces its own.
          // The browser skips laying out and painting rows off screen
          // (`content-visibility`), sizing them as last rendered.
          <div
            key={keyOfRow(element)}
            ref={element_ => {
              if (element_ === null) {
                rows.current.delete(element.id);
              } else {
                rows.current.set(element.id, element_);
              }
            }}
            style={ROW_STYLE}
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
      })}
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

/** Rows off screen are not laid out or painted (sized as last rendered). */
const ROW_STYLE: React.CSSProperties = {
  contentVisibility: 'auto',
  containIntrinsicSize: 'auto 60px',
};

const memoizedEntryList = React.memo(EntryList);

export {memoizedEntryList as EntryList};
