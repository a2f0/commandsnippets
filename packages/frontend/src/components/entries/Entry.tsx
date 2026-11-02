import type {TextEntry} from '@commandsnippets/api-shared';
import Check from '@mui/icons-material/Check';
import FileCopySharp from '@mui/icons-material/FileCopySharp';
import {styled} from '@mui/material/styles';
import React, {useCallback, useEffect, useRef, useState} from 'react';
import {useDrop} from 'react-dnd';
import {useContextMenu} from '../../hooks/useContextMenu';
import {copyEntry} from '../../lib/data/copyEntry';
import {useReadOnly, useSession} from '../../lib/data/hooks';
import {
  deleteEntry,
  reorderEntries,
  tagEntry,
  untagEntry,
} from '../../lib/data/writes';
import {useSearchParam} from '../../lib/router/navigation';
import {appMode} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
import type {SyncSession} from '../../lib/sync/session';
import {DragHandle} from '../dnd/DragHandle';
import {DragHandleContainer} from '../dnd/DragHandleContainer';
import {type DraggableItem, type DropResult, ItemTypes} from '../dnd/itemTypes';
import {useSortableRow} from '../dnd/useSortableRow';
import {MemoizedEntryBody} from './EntryBody';
import {EntryContextMenu} from './EntryContextMenu';
import {EntryEdit} from './EntryEdit';
import {EntryNew} from './EntryNew';
import {MemoizedEntryReuseCount} from './EntryReuseCount';
import {MemoizedEntrySubject} from './EntrySubject';
import {MemoizedEntryTags} from './EntryTags';

const EntryText = styled('div')(() => ({
  display: 'inline-block',
  verticalAlign: 'top',
}));

const EntryContainer = styled('div')(() => ({
  marginBottom: '16px',
  whiteSpace: 'pre',
}));

const CheckIndicator = styled('div')(() => ({
  fontSize: '13px',
}));

const CopyIndicator = styled('div')(() => ({
  fontSize: '13px',
  cursor: 'pointer',
}));

/** Whether the tag's entries are in the user's order: only then reordered. */
const inUserOrder = () =>
  useAppState.getState().tagTextEntryThroughModelSortOrder === 'order';

interface IEntryProps {
  id: string;
  index: number;
  moveEntry: (id: string, to: number) => void;
  findEntry: (id: string) => {entry: TextEntry; index: number};
  object: TextEntry;
  /**
   * The row's key (`keyOfRow`): its local id, when it was made here, which
   * stays when the API's id replaces it. A new entry's form opened next to
   * it is anchored to it, so it stays open, text and all.
   */
  rowKey: string;
  /** The tag the list shows, when it shows one. */
  tagId: string | undefined;
  /** The names of the entry's other tags, shown under it (none: hidden). */
  tagNames: readonly string[];
  findEntryByIndex: (id: number) => TextEntry | null;
  /**
   * Keep the row rendered, out of view too (a long list renders only the
   * rows in view), until the function it returns is called.
   */
  keepRendered: (rowKey: string) => () => void;
}

/**
 * The writes an entry row makes, through the session the row has now: a
 * drop on a tag tags the entry with it (the untagged list drops it, and the
 * tag lists it); a reorder of a tag's entries (the list shows the new order
 * already; the tag's sync stores the new ranks); and its removal from the
 * list: an untagged entry is deleted, a tag's entry taken out of the tag.
 */
function useEntryWrites(
  session: SyncSession | null,
  id: string,
  tagId: string | undefined
) {
  const entriesFilter = useSearchParam('entries');
  const tagWith = useCallback(
    (droppedOn: string) => {
      if (session !== null)
        tagEntry(session, droppedOn, id).catch((error: unknown) =>
          console.error('Failed to tag entry:', error)
        );
    },
    [session, id]
  );
  const reorder = useCallback(
    async (topId: string, bottomId: string) => {
      if (session !== null && tagId !== undefined)
        await reorderEntries(session, tagId, topId, bottomId).catch(
          (error: unknown) => console.error('Failed to reorder entries:', error)
        );
    },
    [session, tagId]
  );
  const removeFromList = useCallback(async () => {
    if (session === null) {
      return;
    }
    const untagged = entriesFilter === 'untagged';
    try {
      if (untagged) {
        await deleteEntry(session, id);
      } else if (tagId !== undefined) {
        // An entry left in no tag joins the untagged list.
        await untagEntry(session, tagId, id);
      }
    } catch (error) {
      console.error(
        untagged ? 'Failed to delete entry:' : 'Failed to untag entry:',
        error
      );
    }
  }, [entriesFilter, id, session, tagId]);
  return {tagWith, reorder, removeFromList};
}

/**
 * The drag handle (for a signed-in user's own entry) and the copy icon show
 * while the pointer is over the row.
 */
function useEntryHover(readOnly: boolean) {
  const loggedIn = useAppState(state => state.loggedInUser !== null);
  const [hoverState, setHoverState] = useState({
    showDragHandle: false,
    showCopyIcon: false,
  });
  const mouseEnter = useCallback(() => {
    setHoverState({showDragHandle: loggedIn && !readOnly, showCopyIcon: true});
  }, [loggedIn, readOnly]);
  const mouseLeave = useCallback(() => {
    setHoverState({showDragHandle: false, showCopyIcon: false});
  }, []);
  const hideCopyIcon = useCallback(() => {
    setHoverState(prev => ({...prev, showCopyIcon: false}));
  }, []);
  return {hoverState, mouseEnter, mouseLeave, hideCopyIcon};
}

/** The copy icon while hovered, or the check mark once copied last. */
const CopyIndicators = ({
  onClick,
  onMouseEnter,
  onMouseLeave,
  hovered,
  copiedLast,
}: {
  onClick: () => void;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  hovered: boolean;
  copiedLast: boolean;
}) => (
  <DragHandleContainer
    onClick={onClick}
    onMouseEnter={onMouseEnter}
    onMouseLeave={onMouseLeave}
  >
    <CopyIndicator
      style={{
        visibility: hovered ? 'visible' : 'hidden',
        display: hovered && !copiedLast ? 'block' : 'none',
      }}
    >
      <FileCopySharp fontSize="inherit" />
    </CopyIndicator>
    <CheckIndicator
      style={{
        visibility: copiedLast ? 'visible' : 'hidden',
        display: copiedLast ? 'block' : 'none',
      }}
    >
      <Check fontSize="inherit" />
    </CheckIndicator>
  </DragHandleContainer>
);

/**
 * Where a new entry's form is open next to the row, if it is: watched
 * alone, so opening or closing one renders only the row it is next to.
 */
const useNewEntryAt = (rowKey: string, readOnly: boolean) =>
  useAppState(state => {
    if (readOnly) return null;
    if (state.entryNew === `textEntry-${rowKey}-top`) return 'top';
    return state.entryNew === `textEntry-${rowKey}-bottom` ? 'bottom' : null;
  });

/**
 * The row as a sortable drag source (`useSortableRow`) and drop target: the
 * refs of its drop target, its preview and its drag handle.
 */
function useEntryDrag(
  {id, index, findEntry, findEntryByIndex, moveEntry}: IEntryProps,
  readOnly: boolean,
  {reorder, tagWith}: ReturnType<typeof useEntryWrites>
) {
  const dropRef = useRef<HTMLDivElement>(null);
  const {isDragging, handleRef, preview, hover} = useSortableRow({
    type: ItemTypes.ENTRY,
    id,
    index,
    readOnly,
    findEntry,
    findEntryByIndex,
    moveEntry,
    reorder,
    onDropOnTag: tagWith,
    canMoveHere: inUserOrder,
  });
  const [, drop] = useDrop<DraggableItem, DropResult>(
    {accept: ItemTypes.ENTRY, hover},
    [hover]
  );
  drop(dropRef);
  const previewBoxRef = useCallback(
    (el: HTMLDivElement | null) => {
      preview(el);
    },
    [preview]
  );
  return {isDragging, handleRef, dropRef, previewBoxRef};
}

/** The drag handle, the subject and (when reused) the reuse count. */
const SubjectLine = ({
  entry,
  handleRef,
  handleShown,
  onMouseEnter,
  onMouseLeave,
}: {
  entry: TextEntry;
  handleRef: (element: HTMLDivElement | null) => void;
  handleShown: boolean;
  onMouseEnter: () => void;
  onMouseLeave: () => void;
}) => (
  <div>
    <DragHandleContainer
      role="entryDragHandleContainer"
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      <DragHandle
        role="entryDragHandle"
        ref={handleRef}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
        style={{visibility: handleShown ? 'visible' : 'hidden'}}
      >
        ::
      </DragHandle>
    </DragHandleContainer>
    <EntryText onMouseEnter={onMouseEnter} onMouseLeave={onMouseLeave}>
      <MemoizedEntrySubject object={entry} />
      {/* Private: public views get 0 from the API, so none. */}
      {entry.attributes.reused_count > 0 && (
        <MemoizedEntryReuseCount count={entry.attributes.reused_count} />
      )}
    </EntryText>
  </div>
);

/** The entry as the list shows it, when it is not being edited. */
const EntryCard = ({
  entry,
  tagNames,
  drag: {dropRef, previewBoxRef, handleRef, isDragging},
  hover: {hoverState, mouseEnter, mouseLeave},
  onContextMenu,
  onCopy,
  onBodyClick,
}: {
  entry: TextEntry;
  tagNames: readonly string[];
  drag: ReturnType<typeof useEntryDrag>;
  hover: Pick<
    ReturnType<typeof useEntryHover>,
    'hoverState' | 'mouseEnter' | 'mouseLeave'
  >;
  onContextMenu: (event: React.MouseEvent) => void;
  onCopy: () => void;
  onBodyClick: (event: React.MouseEvent<HTMLDivElement>) => void;
}) => {
  const {id} = entry;
  // Whether this entry is the one copied last (its check mark shows):
  // watched alone, so copying another entry renders only the rows it
  // changes.
  const copiedLast = useAppState(state => state.mostRecentCopyID === id);
  // Whether this entry is the one selected in the list: watched alone, so
  // selecting another entry renders only the rows it changes.
  const selected = useAppState(
    state =>
      state.entrySelectedID === id && state.appMode === appMode.entriesList
  );
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: Custom role 'entry' is required for tests and drag-and-drop, not a standard ARIA role.
    <div
      role="entry"
      ref={dropRef}
      style={{opacity: isDragging ? 0 : 1}}
      onContextMenu={onContextMenu}
      id={`tagsEntries-${id}`}
    >
      <EntryContainer ref={previewBoxRef}>
        <SubjectLine
          entry={entry}
          handleRef={handleRef}
          handleShown={hoverState.showDragHandle}
          onMouseEnter={mouseEnter}
          onMouseLeave={mouseLeave}
        />
        <div>
          <CopyIndicators
            onClick={onCopy}
            onMouseEnter={mouseEnter}
            onMouseLeave={mouseLeave}
            hovered={hoverState.showCopyIcon}
            copiedLast={copiedLast}
          />
          <EntryText onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
            <MemoizedEntryBody
              handleClick={onBodyClick}
              object={entry}
              selected={selected}
            />
          </EntryText>
        </div>
        {tagNames.length > 0 && <MemoizedEntryTags names={tagNames} />}
      </EntryContainer>
    </div>
  );
};

/**
 * The row's editor (open or not) and a new entry's form next to it. A form
 * open in the row, or a drag of it, keeps the row rendered wherever the
 * list scrolls: unrendered, its text would be lost, or the drag would lose
 * its source.
 */
function useEntryForms(
  {rowKey, keepRendered}: IEntryProps,
  readOnly: boolean,
  isDragging: boolean
) {
  const [isEditing, setIsEditing] = useState(false);
  const handleBeginEdit = useCallback(() => {
    useAppState.getState().setAppMode(appMode.entryEditor);
    setIsEditing(true);
  }, []);
  const handleEditClosed = useCallback(() => setIsEditing(false), []);
  // None on another user's entry.
  const newEntryAt = useNewEntryAt(rowKey, readOnly);
  const held = isDragging || (!readOnly && isEditing) || newEntryAt !== null;
  useEffect(
    () => (held ? keepRendered(rowKey) : undefined),
    [held, keepRendered, rowKey]
  );
  return {isEditing, handleBeginEdit, handleEditClosed, newEntryAt};
}

/** A new entry's form next to the row (above it: `top`). */
const newEntryForm = (
  entryId: string,
  where: 'top' | 'bottom',
  tagId: string | undefined
) => <EntryNew id={`textEntryNew-${entryId}-${where}`} tagId={tagId} />;

/** Opens a new entry's form above the row. */
function useNewEntryAbove(rowKey: string) {
  return useCallback(() => {
    useAppState.getState().setEntryNew(`textEntry-${rowKey}-top`);
  }, [rowKey]);
}

/**
 * Copies the entry's body (`handleCopyClick`) or some text of it: a reuse
 * of the entry, which becomes the one copied last.
 */
function useEntryCopy(
  session: SyncSession | null,
  entry: TextEntry,
  onCopied: () => void
) {
  const copyToClipboard = useCallback(
    (text: string) => {
      onCopied();
      copyEntry(session, entry.id, text);
      useAppState.getState().setMostRecentCopyID(entry.id);
    },
    [onCopied, session, entry.id]
  );
  const handleCopyClick = useCallback(() => {
    copyToClipboard(entry.attributes.body);
  }, [copyToClipboard, entry.attributes.body]);
  return {copyToClipboard, handleCopyClick};
}

const Entry = (props: IEntryProps) => {
  const {id, object: textEntryObject, rowKey, tagId, tagNames} = props;
  const appConfig = useAppConfig();
  const session = useSession();
  // Another user's entry (staff reading it): copied, never reordered,
  // tagged, edited or removed.
  const readOnly = useReadOnly();
  const menu = useContextMenu();
  const writes = useEntryWrites(session, id, tagId);
  const drag = useEntryDrag(props, readOnly, writes);

  const hover = useEntryHover(readOnly);
  const handleNewEntry = useNewEntryAbove(rowKey);

  const {isEditing, handleBeginEdit, handleEditClosed, newEntryAt} =
    useEntryForms(props, readOnly, drag.isDragging);

  const {copyToClipboard, handleCopyClick} = useEntryCopy(
    session,
    textEntryObject,
    hover.hideCopyIcon
  );

  const handleBodyClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const selection = window.getSelection();
      const selectionString = selection?.toString();
      appConfig.setAppMode(appMode.entriesList);

      if (!selectionString) {
        copyToClipboard(textEntryObject.attributes.body);
        appConfig.setEntrySelectedID(textEntryObject.id);
      } else {
        copyToClipboard(selectionString);
      }
    },
    [appConfig, copyToClipboard, textEntryObject]
  );

  return (
    <>
      {newEntryAt === 'top' && newEntryForm(id, 'top', tagId)}
      {!isEditing && (
        <EntryCard
          entry={textEntryObject}
          tagNames={tagNames}
          drag={drag}
          hover={hover}
          onContextMenu={menu.onContextMenu}
          onCopy={handleCopyClick}
          onBodyClick={handleBodyClick}
        />
      )}
      {newEntryAt === 'bottom' && newEntryForm(id, 'bottom', tagId)}

      {(appConfig.loggedInUser !== null || readOnly) && (
        <EntryContextMenu
          mouse={menu.mouse}
          onClose={menu.close}
          id={id}
          text_entry={textEntryObject}
          handleRemoveFromListParent={writes.removeFromList}
          handleNewEntryParent={handleNewEntry}
          handleBeginEditParent={handleBeginEdit}
          handleCopyParent={handleCopyClick}
          readOnly={readOnly}
        />
      )}

      {isEditing && !readOnly && (
        <EntryEdit
          id={`textEntryEdit${id}`}
          object={textEntryObject}
          handleSaveParent={handleEditClosed}
          handleCancelEditParent={handleEditClosed}
        />
      )}
    </>
  );
};

const memoizedEntry = React.memo(Entry);

export {memoizedEntry as Entry};
