import {Check, FileCopySharp} from '@mui/icons-material';
import {styled} from '@mui/material/styles';
import {autorun} from 'mobx';
import {observer} from 'mobx-react';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useDrag, useDrop} from 'react-dnd';
import {useParams, useSearchParams} from 'react-router-dom';

import {useAppContext} from './AppContext';
import {DragHandle} from './DragHandle';
import {DragHandleContainer} from './DragHandleContainer';
import {EntryContextMenu} from './EntryContextMenu';
import {EntryEdit} from './EntryEdit';
import {EntryNew} from './EntryNew';
import {ItemTypes} from './ItemTypes';
import {tearleadsApi} from './lib/api/tearleadsApi';
import {appMode, getSelection, type IMouse, initialMouse} from './lib/shared';
import type {ITextEntryJsonApi} from './lib/store/models/TextEntryModel';
import type {ITextEntryJsonApiResponseSingle} from './lib/text_entries';
import {MemoizedEntryBody} from './styled/text_entries/EntryBody';
import {MemoizedEntrySubject} from './styled/text_entries/EntrySubject';
import type {DraggableItem, DropResult} from './Tag';

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
  findEntry: (id: string) => {entry: ITextEntryJsonApi; index: number};
  handleRemoveFromListParent: (id: string) => void;
  object: ITextEntryJsonApi;
  filterAndSortParent: () => void;
  findEntryByIndex: (id: number) => ITextEntryJsonApi | null;
}

const Entry = ({
  id,
  index,
  moveEntry,
  findEntry,
  handleRemoveFromListParent,
  object,
  filterAndSortParent,
  findEntryByIndex,
}: IEntryProps) => {
  const appConfig = useAppContext();
  const [textEntryObject, setTextEntryObject] =
    useState<ITextEntryJsonApi>(object);
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const [showCopyIcon, setShowCopyIcon] = useState(false);
  const [showCheckIcon, setShowCheckIcon] = useState(false);
  const {tag, user} = useParams();
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');
  const previewRef = useRef<HTMLDivElement>(null);
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
              tearleadsApi
                .tagEntry(dropResult.id, findEntry(id).entry.id)
                .then(resp => {
                  appConfig.updateOrCreateTagTextEntryThroughModel(resp.data);
                })
                .catch((error: unknown) => {
                  console.error('Failed to tag entry:', error);
                });
              if (entriesFilter === 'untagged') {
                //Then an untagged entry was tagged
                handleRemoveFromListParent(object.id);
                appConfig.removeUntaggedTextEntry(object.id);
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
                let ordered_top: ITextEntryJsonApi | null;
                let ordered_bottom: ITextEntryJsonApi | null;
                if (entry_below === null) {
                  //Then it was moved to the bottom position, get the entry before it.
                  ordered_top = findEntryByIndex(index - 1);
                  ordered_bottom = entry;
                } else {
                  ordered_top = entry;
                  ordered_bottom = entry_below;
                }
                if (ordered_top !== null && ordered_bottom !== null) {
                  // Then find the junction entries.
                  const userObject = appConfig.usersArray.find(
                    element =>
                      element.id === textEntryObject.relationships.user.data.id
                  );

                  const tagObject = appConfig.tagsArray.find(
                    element =>
                      element.relationships.user.data.id === userObject?.id &&
                      element.relationships.user.data.id ===
                        textEntryObject.relationships.user.data.id &&
                      element.attributes.name === tag
                  );

                  const throughModelTop =
                    appConfig.tagTextEntryThroughModel.find(
                      element =>
                        element.relationships.tag.data.id === tagObject?.id &&
                        element.relationships.text_entry.data.id ===
                          ordered_top?.id
                    );

                  const throughModelBottom =
                    appConfig.tagTextEntryThroughModel.find(
                      element =>
                        element.relationships.tag.data.id === tagObject?.id &&
                        element.relationships.text_entry.data.id ===
                          ordered_bottom?.id
                    );
                  if (throughModelTop === undefined) {
                    throw new Error('Top must be defined.');
                  }
                  if (throughModelBottom === undefined) {
                    throw new Error('Bottom must be defined.');
                  }
                  await tearleadsApi.reorderEntry(
                    throughModelTop.id,
                    throughModelBottom.id
                  );
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
    [id, originalIndex, moveEntry]
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

  useEffect(
    () =>
      autorun(() => {
        if (appConfig.mostRecentCopyID === object.id) {
          setShowCheckIcon(true);
        } else {
          setShowCheckIcon(false);
        }
      }),
    [appConfig.mostRecentCopyID, appConfig.mostRecentCopyType]
  );

  const mouseEnter = () => {
    if (appConfig.loggedInUser !== null) {
      setShowDragHandle(true);
    }
    setShowCopyIcon(true);
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
    setShowCopyIcon(false);
  };

  const [mouse, setMouse] = useState(initialMouse);
  const [isEditing, setIsEditing] = useState(false);

  const handleBeginEdit = () => {
    appConfig.setAppMode(appMode.entryEditor);
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  const handleSave = (object: ITextEntryJsonApiResponseSingle) => {
    const existing = appConfig.textEntriesArray.find(
      o => o.id === object.data.id
    );
    existing?.update(object.data);
    setTextEntryObject(object.data);
    setIsEditing(false);
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    mouseData.mouseX = event.clientX - 2;
    mouseData.mouseY = event.clientY - 4;
    setMouse(mouseData);
  };

  const handleNewEntry = () => {
    appConfig.setEntryNew(`textEntry-${object.id}-top`);
  };

  const handleRemoveFromList = () => {
    const userObject = appConfig.usersArray.find(
      element => element.attributes.username === user
    );

    const tagObject = appConfig.tagsArray.find(
      element =>
        element.attributes.name === tag &&
        element.relationships.user.data.id === userObject?.id
    );

    const tagTextEntryThroughModelObject =
      appConfig.tagTextEntryThroughModel.find(
        element =>
          element.relationships.tag.data.id === tagObject?.id &&
          element.relationships.text_entry.data.id === textEntryObject.id
      );
    if (!tagTextEntryThroughModelObject?.id) {
      console.error('Cannot untag entry: missing tagTextEntryThroughModel ID');
      return;
    }

    tearleadsApi
      .untagEntry(tagTextEntryThroughModelObject.id)
      .then(() => {
        tagTextEntryThroughModelObject?.remove();
        handleRemoveFromListParent(textEntryObject.id);
      })
      .catch((error: unknown) => {
        console.error('Failed to untag entry:', error);
      });
  };

  const handleCopyClick = () => {
    setShowCopyIcon(false);
    setShowCheckIcon(true);
    navigator.clipboard.writeText(textEntryObject.attributes.body);
    appConfig.setMostRecentCopyType(textEntryObject.type);
    appConfig.setMostRecentCopyID(textEntryObject.id);
  };

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
      />
    ),
    [mouse]
  );

  const handleBodyClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const selection = getSelection();
    const selectionString = selection?.toString();
    appConfig.setAppMode(appMode.entriesList);
    if (selectionString === undefined || selectionString.length === 0) {
      setShowCopyIcon(false);
      setShowCheckIcon(true);
      navigator.clipboard.writeText(textEntryObject.attributes.body);
      appConfig.setMostRecentCopyType(textEntryObject.type);
      appConfig.setMostRecentCopyID(textEntryObject.id);
      appConfig.setAppMode(appMode.entriesList);
      appConfig.setEntrySelectedID(textEntryObject.id);
    } else {
      setShowCopyIcon(false);
      setShowCheckIcon(true);
      navigator.clipboard.writeText(selectionString);
      appConfig.setMostRecentCopyType(textEntryObject.type);
      appConfig.setMostRecentCopyID(textEntryObject.id);
      appConfig.setAppMode(appMode.entriesList);
    }
  };

  const previewBoxRef = (el: HTMLDivElement | null) => {
    previewRef.current = el;
    preview(el);
  };

  return (
    <>
      {appConfig.entryNew === `textEntry-${object.id}-top` && (
        <EntryNew
          id={`textEntryNew-${object.id}-top`}
          filterAndSortParent={filterAndSortParent}
        />
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
                  style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
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
                    visibility: showCopyIcon ? 'visible' : 'hidden',
                    display: showCopyIcon && !showCheckIcon ? 'block' : 'none',
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
                />
              </EntryText>
            </div>
          </EntryContainer>
        </div>
      )}
      {appConfig.entryNew === `textEntry-${object.id}-bottom` && (
        <EntryNew
          id={`textEntryNew-${object.id}-bottom`}
          filterAndSortParent={filterAndSortParent}
        />
      )}

      {appConfig.loggedInUser && <>{contextMenu}</>}

      {isEditing && (
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

const memoizedEntry = React.memo(observer(Entry));

export {memoizedEntry as Entry};
