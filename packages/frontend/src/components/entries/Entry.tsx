import type {TextEntry} from '@commandsnippets/api-shared';
import {Check, FileCopySharp} from '@mui/icons-material';
import {styled} from '@mui/material/styles';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useDrag, useDrop} from 'react-dnd';
import {useSearchParams} from 'react-router-dom';
import {useReadOnly, useSession} from '../../lib/data/hooks';
import {
  deleteEntry,
  reorderEntries,
  tagEntry,
  untagEntry,
} from '../../lib/data/writes';
import {appMode, getSelection, initialMouse} from '../../lib/shared';
import {useAppConfig, useAppState} from '../../lib/state/appState';
import {DragHandle} from '../dnd/DragHandle';
import {DragHandleContainer} from '../dnd/DragHandleContainer';
import {type DraggableItem, type DropResult, ItemTypes} from '../dnd/itemTypes';
import {MemoizedEntryBody} from './EntryBody';
import {EntryContextMenu} from './EntryContextMenu';
import {EntryEdit} from './EntryEdit';
import {EntryNew} from './EntryNew';
import {MemoizedEntrySubject} from './EntrySubject';

const EntryText = styled('div')(() => ({
  display: 'inline-block',
  verticalAlign: 'top',
}));

type EntryContainerProps = React.HTMLAttributes<HTMLDivElement> &
  React.RefAttributes<HTMLDivElement>;

const EntryContainerBase = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>((props, ref) => {
  const refValue = ref;
  return <div {...props} ref={refValue} />;
});

export const EntryContainer: React.ComponentType<EntryContainerProps> = styled(
  EntryContainerBase
)(() => ({
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

const ReuseCount = styled('div')(() => ({
  display: 'inline-block',
  verticalAlign: 'top',
}));

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
  findEntryByIndex,
  keepRendered,
}: IEntryProps) => {
  const appConfig = useAppConfig();
  const session = useSession();
  // Another user's entry (staff reading it): copied, never reordered,
  // tagged, edited or removed.
  const readOnly = useReadOnly();
  const textEntryObject = object;
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const originalIndex = findEntry(id).index;
  const [hoverState, setHoverState] = useState({
    showDragHandle: false,
    showCopyIcon: false,
  });
  const [showCheckIcon, setShowCheckIcon] = useState(false);
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');
  const previewRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState(initialMouse);
  const [isEditing, setIsEditing] = useState(false);
  const [{isDragging}, drag, preview] = useDrag<
    DraggableItem,
    DropResult,
    {isDragging: boolean}
  >(
    {
      item: (): DraggableItem => ({
        id,
        originalIndex,
        type: ItemTypes.ENTRY,
        index,
      }),
      type: ItemTypes.ENTRY,
      canDrag: () => !readOnly,
      collect: monitor => ({
        isDragging: monitor.isDragging(),
      }),
      end: async (draggedItem, monitor) => {
        const {id: droppedId, originalIndex} = monitor.getItem();
        console.debug(
          `useDrag end: draggedItem ID: ${draggedItem.id} originalIndex: ${draggedItem.originalIndex} index ${draggedItem.index}`
        );
        console.debug(
          `useDrag end: droppedId: ${droppedId} originalIndex ${originalIndex}`
        );
        const didDrop = monitor.didDrop();
        if (!didDrop) {
          console.debug('!didDrop');
          // Then the target did not handle the drop.
          // Move the entry in the state of the list.
          moveEntry(droppedId, originalIndex);
        } else {
          // Then it was dropped on something.
          const dropResult = monitor.getDropResult();
          if (dropResult) {
            if (dropResult.type === 'Tag') {
              // Stored with the entry as it is now: the untagged list drops
              // it, and the tag lists it.
              if (session !== null) {
                tagEntry(session, dropResult.id, findEntry(id).entry.id).catch(
                  (error: unknown) => {
                    console.error('Failed to tag entry:', error);
                  }
                );
              }
            } else if (draggedItem.type === 'entry') {
              // Then it was dropped on an entry (this is being reordered in the list).
              const {index} = draggedItem;
              if (originalIndex !== index) {
                console.info(
                  `it moved from index ${originalIndex} to ${index}`
                );
                const entry = findEntry(id).entry;
                const entry_below = findEntryByIndex(index + 1);
                let ordered_top: TextEntry | null;
                let ordered_bottom: TextEntry | null;
                if (entry_below === null) {
                  //Then it was moved to the bottom position, get the entry before it.
                  ordered_top = findEntryByIndex(index - 1);
                  ordered_bottom = entry;
                } else {
                  ordered_top = entry;
                  ordered_bottom = entry_below;
                }
                if (
                  ordered_top !== null &&
                  ordered_bottom !== null &&
                  session !== null &&
                  tagId !== undefined
                ) {
                  // The list shows the new order already; the tag's sync
                  // stores the new ranks.
                  await reorderEntries(
                    session,
                    tagId,
                    ordered_top.id,
                    ordered_bottom.id
                  ).catch((error: unknown) => {
                    console.error('Failed to reorder entries:', error);
                  });
                }
              } else {
                console.debug('useDrag end: it was not moved within the list.');
              }
            } else {
              throw new Error(`Unknown drop result type: ${dropResult.type}`);
            }
          }
        }
      },
    },
    [id, originalIndex, moveEntry, readOnly]
  );
  // Make sure opacity is above the useDrag call above
  const opacity = isDragging ? 0 : 1;
  const [, drop] = useDrop(
    {
      accept: ItemTypes.ENTRY,
      hover: (item: DraggableItem, monitor) => {
        console.debug(`hover: index ${index} originalIndex ${originalIndex}`);
        if (!dragRef.current) {
          return;
        }
        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) {
          return;
        }
        if (appConfig.tagTextEntryThroughModelSortOrder !== 'order') {
          return;
        }
        // Determine rectangle on screen
        const hoverBoundingRect = dragRef.current?.getBoundingClientRect();
        // Get vertical middle
        const hoverMiddleY =
          (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2;
        // Determine mouse position
        const clientOffset = monitor.getClientOffset();
        // Get pixels to the top
        if (clientOffset !== null) {
          const hoverClientY = clientOffset.y - hoverBoundingRect.top;

          // Only perform the move when the mouse has crossed half of the items height
          // When dragging downwards, only move when the cursor is below 50%
          // When dragging upwards, only move when the cursor is above 50%
          // Dragging downwards
          if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
            return;
          }
          // Dragging upwards
          if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
            return;
          }
          moveEntry(item.id, hoverIndex);
          // Note: we're mutating the monitor item here!
          // Generally it's better to avoid mutations,
          // but it's good here for the sake of performance
          // to avoid expensive index searches.
          item.index = hoverIndex;
        }
      },
    },
    [findEntry, moveEntry]
  );

  drag(dragRef);
  drop(dropRef);

  // Whether this entry is the one copied last: watched alone, so copying
  // another entry renders only the rows it changes.
  const copiedLast = useAppState(state => state.mostRecentCopyID === object.id);
  // Whether this entry is the one selected in the list: watched alone, so
  // selecting another entry renders only the rows it changes.
  const selected = useAppState(
    state =>
      state.entrySelectedID === object.id &&
      state.appMode === appMode.entriesList
  );
  useEffect(() => {
    setShowCheckIcon(copiedLast);
  }, [copiedLast]);

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

  // A form open in the row (its editor, or a new entry's), or a drag of it,
  // keeps the row rendered wherever the list scrolls: unrendered, its text
  // would be lost, or the drag would lose its source.
  const newEntryHere =
    appConfig.entryNew === `textEntry-${rowKey}-top` ||
    appConfig.entryNew === `textEntry-${rowKey}-bottom`;
  const held = isDragging || (!readOnly && (isEditing || newEntryHere));
  useEffect(
    () => (held ? keepRendered(rowKey) : undefined),
    [held, keepRendered, rowKey]
  );

  const handleContextClick = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setMouse({
        mouseX: event.clientX - 2,
        mouseY: event.clientY - 4,
      });
    },
    []
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
      setShowCheckIcon(true);
      navigator.clipboard.writeText(text);
      appConfig.setMostRecentCopyType(textEntryObject.type);
      appConfig.setMostRecentCopyID(textEntryObject.id);
    },
    [appConfig, textEntryObject.type, textEntryObject.id]
  );

  const handleCopyClick = useCallback(() => {
    copyToClipboard(textEntryObject.attributes.body);
  }, [copyToClipboard, textEntryObject.attributes.body]);

  const contextMenu = useMemo(
    () => (
      <EntryContextMenu
        mouse={mouse}
        id={id}
        text_entry={textEntryObject}
        handleRemoveFromListParent={handleRemoveFromList}
        handleNewEntryParent={handleNewEntry}
        handleBeginEditParent={handleBeginEdit}
        handleCopyParent={handleCopyClick}
        readOnly={readOnly}
      />
    ),
    [
      readOnly,
      mouse,
      id,
      textEntryObject,
      handleRemoveFromList,
      handleNewEntry,
      handleBeginEdit,
      handleCopyClick,
    ]
  );

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
      {appConfig.entryNew === `textEntry-${rowKey}-top` && !readOnly && (
        <EntryNew id={`textEntryNew-${object.id}-top`} tagId={tagId} />
      )}
      {!isEditing && (
        // biome-ignore lint/a11y/noStaticElementInteractions: Custom role 'entry' is required for tests and drag-and-drop, not a standard ARIA role.
        <div
          role="entry"
          ref={dropRef}
          style={{opacity}}
          onContextMenu={handleContextClick}
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
                  ref={dragRef}
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
              <ReuseCount onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
                {/* {text_entry.attributes.reused_count} */}
              </ReuseCount>
              <EntryText onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
                <MemoizedEntrySubject object={textEntryObject} />
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
                      hoverState.showCopyIcon && !showCheckIcon
                        ? 'block'
                        : 'none',
                  }}
                >
                  <FileCopySharp fontSize="inherit" />
                </CopyIndicator>
                <CheckIndicator
                  style={{
                    visibility: showCheckIcon ? 'visible' : 'hidden',
                    display: showCheckIcon ? 'block' : 'none',
                  }}
                >
                  <Check fontSize="inherit" />
                </CheckIndicator>
              </DragHandleContainer>
              <ReuseCount />
              <EntryText onMouseEnter={mouseEnter} onMouseLeave={mouseLeave}>
                <MemoizedEntryBody
                  handleClick={handleBodyClick}
                  object={textEntryObject}
                  selected={selected}
                />
              </EntryText>
            </div>
          </EntryContainer>
        </div>
      )}
      {appConfig.entryNew === `textEntry-${rowKey}-bottom` && !readOnly && (
        <EntryNew id={`textEntryNew-${object.id}-bottom`} tagId={tagId} />
      )}

      {appConfig.loggedInUser && <>{contextMenu}</>}

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
