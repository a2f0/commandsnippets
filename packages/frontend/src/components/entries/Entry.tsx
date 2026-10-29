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
import {appMode, getSelection} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
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

const Entry = ({
  id,
  index,
  moveEntry,
  findEntry,
  object,
  rowKey,
  tagId,
  tagNames,
  findEntryByIndex,
  keepRendered,
}: IEntryProps) => {
  const appConfig = useAppConfig();
  const session = useSession();
  // Another user's entry (staff reading it): copied, never reordered,
  // tagged, edited or removed.
  const readOnly = useReadOnly();
  const textEntryObject = object;
  const dropRef = useRef<HTMLDivElement>(null);
  const [hoverState, setHoverState] = useState({
    showDragHandle: false,
    showCopyIcon: false,
  });
  const entriesFilter = useSearchParam('entries');
  const previewRef = useRef<HTMLDivElement>(null);
  const menu = useContextMenu();
  const [isEditing, setIsEditing] = useState(false);
  // A drop on a tag tags the entry with it: the untagged list drops it,
  // and the tag lists it.
  const tagWith = useCallback(
    (droppedOn: string) => {
      if (session === null) {
        return;
      }
      tagEntry(session, droppedOn, id).catch((error: unknown) => {
        console.error('Failed to tag entry:', error);
      });
    },
    [session, id]
  );

  // The list shows the new order already; the tag's sync stores the new
  // ranks.
  const reorder = useCallback(
    async (topId: string, bottomId: string) => {
      if (session === null || tagId === undefined) {
        return;
      }
      await reorderEntries(session, tagId, topId, bottomId).catch(
        (error: unknown) => {
          console.error('Failed to reorder entries:', error);
        }
      );
    },
    [session, tagId]
  );

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
  const opacity = isDragging ? 0 : 1;
  const [, drop] = useDrop<DraggableItem, DropResult>(
    {accept: ItemTypes.ENTRY, hover},
    [hover]
  );

  drop(dropRef);

  // Whether this entry is the one copied last (its check mark shows):
  // watched alone, so copying another entry renders only the rows it
  // changes.
  const copiedLast = useAppState(state => state.mostRecentCopyID === object.id);
  // Whether this entry is the one selected in the list: watched alone, so
  // selecting another entry renders only the rows it changes.
  const selected = useAppState(
    state =>
      state.entrySelectedID === object.id &&
      state.appMode === appMode.entriesList
  );
  const mouseEnter = useCallback(() => {
    setHoverState({
      showDragHandle: appConfig.loggedInUser !== null && !readOnly,
      showCopyIcon: true,
    });
  }, [appConfig.loggedInUser, readOnly]);

  const mouseLeave = useCallback(() => {
    setHoverState({
      showDragHandle: false,
      showCopyIcon: false,
    });
  }, []);

  const handleBeginEdit = useCallback(() => {
    appConfig.setAppMode(appMode.entryEditor);
    setIsEditing(true);
  }, [appConfig]);

  const handleCancelEdit = useCallback(() => {
    setIsEditing(false);
  }, []);

  const handleSave = useCallback(() => {
    setIsEditing(false);
  }, []);

  // Where a new entry's form is open next to the row, if it is: watched
  // alone, so opening or closing one renders only the row it is next to.
  const newEntryAt = useAppState(state =>
    state.entryNew === `textEntry-${rowKey}-top`
      ? 'top'
      : state.entryNew === `textEntry-${rowKey}-bottom`
        ? 'bottom'
        : null
  );
  // A form open in the row (its editor, or a new entry's), or a drag of it,
  // keeps the row rendered wherever the list scrolls: unrendered, its text
  // would be lost, or the drag would lose its source.
  const held = isDragging || (!readOnly && (isEditing || newEntryAt !== null));
  useEffect(
    () => (held ? keepRendered(rowKey) : undefined),
    [held, keepRendered, rowKey]
  );

  const handleNewEntry = useCallback(() => {
    appConfig.setEntryNew(`textEntry-${rowKey}-top`);
  }, [appConfig, rowKey]);

  /** Delete an untagged entry; take a tag's entry out of the tag. */
  const handleRemoveFromList = useCallback(async () => {
    if (session === null) {
      return;
    }
    try {
      if (entriesFilter === 'untagged') {
        await deleteEntry(session, textEntryObject.id);
      } else if (tagId !== undefined) {
        // An entry left in no tag joins the untagged list.
        await untagEntry(session, tagId, textEntryObject.id);
      }
    } catch (error) {
      console.error(
        entriesFilter === 'untagged'
          ? 'Failed to delete entry:'
          : 'Failed to untag entry:',
        error
      );
    }
  }, [entriesFilter, textEntryObject.id, session, tagId]);

  const copyToClipboard = useCallback(
    (text: string) => {
      setHoverState(prev => ({...prev, showCopyIcon: false}));
      copyEntry(session, textEntryObject.id, text);
      appConfig.setMostRecentCopyID(textEntryObject.id);
    },
    [appConfig, session, textEntryObject.id]
  );

  const handleCopyClick = useCallback(() => {
    copyToClipboard(textEntryObject.attributes.body);
  }, [copyToClipboard, textEntryObject.attributes.body]);

  const handleBodyClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      const selection = getSelection();
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

  const previewBoxRef = useCallback(
    (el: HTMLDivElement | null) => {
      previewRef.current = el;
      preview(el);
    },
    [preview]
  );

  return (
    <>
      {newEntryAt === 'top' && !readOnly && (
        <EntryNew id={`textEntryNew-${object.id}-top`} tagId={tagId} />
      )}
      {!isEditing && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Custom role 'entry' is required for tests and drag-and-drop, not a standard ARIA role.
        <div
          role="entry"
          ref={dropRef}
          style={{opacity}}
          onContextMenu={menu.onContextMenu}
          id={`tagsEntries-${id}`}
        >
          <EntryContainer ref={previewBoxRef}>
            <div>
              <DragHandleContainer
                role="entryDragHandleContainer"
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
              >
                <DragHandle
                  role="entryDragHandle"
                  ref={handleRef}
                  onMouseEnter={mouseEnter}
                  onMouseLeave={mouseLeave}
                  style={{
                    visibility: hoverState.showDragHandle
                      ? 'visible'
                      : 'hidden',
                  }}
                >
                  ::
                </DragHandle>
              </DragHandleContainer>
              <EntryText onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
                <MemoizedEntrySubject object={textEntryObject} />
                {/* Private: public views get 0 from the API, so none. */}
                {textEntryObject.attributes.reused_count > 0 && (
                  <MemoizedEntryReuseCount
                    count={textEntryObject.attributes.reused_count}
                  />
                )}
              </EntryText>
            </div>
            <div>
              <DragHandleContainer
                onClick={handleCopyClick}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
              >
                <CopyIndicator
                  style={{
                    visibility: hoverState.showCopyIcon ? 'visible' : 'hidden',
                    display:
                      hoverState.showCopyIcon && !copiedLast ? 'block' : 'none',
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
              <EntryText onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
                <MemoizedEntryBody
                  handleClick={handleBodyClick}
                  object={textEntryObject}
                  selected={selected}
                />
              </EntryText>
            </div>
            {tagNames.length > 0 && <MemoizedEntryTags names={tagNames} />}
          </EntryContainer>
        </div>
      )}
      {newEntryAt === 'bottom' && !readOnly && (
        <EntryNew id={`textEntryNew-${object.id}-bottom`} tagId={tagId} />
      )}

      {(appConfig.loggedInUser !== null || readOnly) && (
        <EntryContextMenu
          mouse={menu.mouse}
          onClose={menu.close}
          id={id}
          text_entry={textEntryObject}
          handleRemoveFromListParent={handleRemoveFromList}
          handleNewEntryParent={handleNewEntry}
          handleBeginEditParent={handleBeginEdit}
          handleCopyParent={handleCopyClick}
          readOnly={readOnly}
        />
      )}

      {isEditing && !readOnly && (
        <EntryEdit
          id={`textEntryEdit${object.id}`}
          object={textEntryObject}
          handleSaveParent={handleSave}
          handleCancelEditParent={handleCancelEdit}
        />
      )}
    </>
  );
};

const memoizedEntry = React.memo(Entry);

export {memoizedEntry as Entry};
