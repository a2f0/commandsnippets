import type {TextEntry} from '@commandsnippets/api-shared';
import {Box} from '@mui/material';
import React, {useEffect} from 'react';
import {useDrop} from 'react-dnd';
import {useContextMenu} from '../../hooks/useContextMenu';
import {useListKeyboard} from '../../hooks/useListKeyboard';
import {useMounted} from '../../hooks/useMounted';
import {copyEntry} from '../../lib/data/copyEntry';
import {NO_TAG_NAMES} from '../../lib/data/entryTags';
import {useReadOnly, useSession} from '../../lib/data/hooks';
import {keyOfRow} from '../../lib/data/rowKey';
import {useRenderTiming} from '../../lib/metrics/hooks';
import {appMode} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {ItemTypes} from '../dnd/itemTypes';
import {useDraggedRows} from '../dnd/useDraggedRows';
import {EntryListContextMenu} from './EntryListContextMenu';
import {EntryNew} from './EntryNew';
import {EntryRow, type EntryRowPlace, type EntryRowShared} from './EntryRow';
import {useShownEntries} from './useShownEntries';
import {useVirtualRows} from './useVirtualRows';

const subjectOf = (entry: TextEntry) => entry.attributes.subject;

/** Selects the first entry when the one selected is not in the list. */
function useSelectionShown(shown: readonly TextEntry[] | undefined) {
  const appConfig = useAppConfig();
  useEffect(() => {
    const [first] = shown ?? [];
    if (
      first !== undefined &&
      !shown?.some(entry => entry.id === appConfig.entrySelectedID)
    ) {
      appConfig.setEntrySelectedID(first.id);
    }
  }, [shown, appConfig]);
}

/**
 * The rows, in one parent however many there are: a list that grows or
 * shrinks past `VIRTUALIZE_FROM` keeps its rows (and their forms) rendered
 * as they were.
 */
const EntryRows = ({
  virtual: {virtualized, virtualizer, list},
  entries,
  row,
}: {
  virtual: ReturnType<typeof useVirtualRows>;
  entries: readonly TextEntry[];
  row: (
    entry: TextEntry,
    index: number,
    placed?: EntryRowPlace
  ) => React.ReactNode;
}) => (
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
          const entry = entries[item.index];
          return entry === undefined
            ? null
            : row(entry, item.index, {
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
      : entries.map((entry, index) => row(entry, index))}
  </div>
);

/**
 * The entries shown (`useShownEntries`), selected with the arrow keys and
 * copied with Enter. A long list renders only the rows in view
 * (`useVirtualRows`), as the window scrolls. Each render is timed for the
 * HUD.
 */
const EntryList = () => {
  const renderStart = performance.now();
  const appConfig = useAppConfig();
  // Another user's entries (staff reading them): no New Entry.
  const readOnly = useReadOnly();
  // Whose entries a copy (Enter) counts a reuse of: none but the owner's.
  const session = useSession();
  const mounted = useMounted();
  const {shown, currentTag, tagId, tagNames} = useShownEntries();

  // The list as a drag reorders it.
  const {
    rows: entries,
    findEntry,
    findEntryByIndex,
    moveEntry,
  } = useDraggedRows(shown, subjectOf);
  useSelectionShown(shown);

  const virtual = useVirtualRows(entries);
  const {rows, keepRendered, scrollTo} = virtual;

  useListKeyboard({
    mode: appMode.entriesList,
    rows: entries,
    selectedId: appConfig.entrySelectedID,
    onSelect: (entry, index, up) => {
      appConfig.setEntrySelectedID(entry.id);
      scrollTo(index, entry.id, up ? 'start' : 'end');
    },
    onEnter: selected => {
      void copyEntry(session, selected.id, selected.attributes.body).then(
        copied => {
          if (copied && mounted.current) {
            appConfig.setMostRecentCopyID(selected.id);
          }
        }
      );
    },
  });

  const [, drop] = useDrop({accept: ItemTypes.ENTRY});
  const dropBoxRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  const menu = useContextMenu();

  useRenderTiming('EntryList', renderStart, `${entries.length} rows`);

  const shared: EntryRowShared = {
    moveEntry,
    findEntry,
    findEntryByIndex,
    keepRendered,
    tagId,
  };
  // Keyed so a row made here stays the same component (an open editor and
  // its text too) when the API's id replaces its own.
  const row = (entry: TextEntry, index: number, placed?: EntryRowPlace) => (
    <EntryRow
      key={keyOfRow(entry)}
      entry={entry}
      index={index}
      tagNames={tagNames.get(entry.id) ?? NO_TAG_NAMES}
      shared={shared}
      elements={rows.current}
      placed={placed}
    />
  );

  return (
    <Box
      ref={dropBoxRef}
      id="tagsEntriesList"
      onMouseDown={() => appConfig.setEntrySelectedID('')}
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
      <EntryRows virtual={virtual} entries={entries} row={row} />
      {appConfig.entryNew === 'textEntry-bottom' && !readOnly && (
        <EntryNew id="textEntryNewBottom" tagId={currentTag?.id} />
      )}
      <Box
        onContextMenu={readOnly ? undefined : menu.onContextMenu}
        sx={{flexGrow: '1'}}
      />
      {appConfig.loggedInUser && !readOnly && (
        <EntryListContextMenu mouse={menu.mouse} onClose={menu.close} />
      )}
    </Box>
  );
};

const memoizedEntryList = React.memo(EntryList);

export {memoizedEntryList as EntryList};
