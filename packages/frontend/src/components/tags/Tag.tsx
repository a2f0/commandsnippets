import type {StyledComponent} from '@emotion/styled';
import {Box, ListItem, ListItemButton} from '@mui/material';
import type {Theme} from '@mui/material/styles';
import {styled, useTheme} from '@mui/material/styles';
import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useDrag, useDrop} from 'react-dnd';
import {useNavigate, useParams} from 'react-router-dom';
import type {ITagJsonApi} from '../../lib/api/responses/types';
import {useReadOnly, useSession} from '../../lib/data/hooks';
import {deleteTag as deleteStoredTag, reorderTags} from '../../lib/data/writes';
import {needsScrollingIntoView} from '../../lib/scroll';
import {
  activeSearch,
  appMode,
  type IMouse,
  initialMouse,
} from '../../lib/shared';
import {useAppConfig} from '../../lib/state/appState';
import {DragHandle} from '../dnd/DragHandle';
import {DragHandleContainer} from '../dnd/DragHandleContainer';
import {type DraggableItem, type DropResult, ItemTypes} from '../dnd/itemTypes';
import {TagContextMenu} from './TagContextMenu';
import {TagEdit} from './TagEdit';
import {TagLabel} from './TagLabel';

const TagContainer = styled('div')(() => ({
  whiteSpace: 'pre',
  lineHeight: '20px',
}));

// Update TagLabelWrapper definition
const TagLabelWrapper = styled('div', {
  shouldForwardProp: prop => prop !== 'ref',
})`
  display: inline-block;
  cursor: pointer;
  width: calc(100% - ${props => props.theme.main.dragIndicatorWidth}px);
  font-size: 14px;
` as StyledComponent<{
  ref?: React.RefCallback<HTMLDivElement>;
  id?: string;
  role?: string;
  children?: React.ReactNode;
}>;

interface DroppableItem {
  isOver: boolean;
  canDrop: boolean;
}

interface ITagProps {
  id: string;
  object: ITagJsonApi;
  moveEntry: (id: string, atIndex: number) => void;
  findEntry: (id: string) => {entry: ITagJsonApi; index: number};
  index: number;
  findEntryByIndex: (id: number) => ITagJsonApi | null;
  isSelected: boolean;
  movedSelectedUp: boolean;
  setSelectedTag: (id: string) => void;
}

const Tag = ({
  id,
  object,
  moveEntry,
  findEntry,
  index,
  findEntryByIndex,
  isSelected,
  movedSelectedUp,
  setSelectedTag,
}: ITagProps) => {
  const tagObject = object;
  const appConfig = useAppConfig();
  const session = useSession();
  // Another user's tags (staff reading them): no reordering, editing or
  // context menu.
  const readOnly = useReadOnly();
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const theme: Theme = useTheme();
  const {user, tag: shownTag} = useParams();
  const navigate = useNavigate();
  const tagRef = useRef<HTMLLIElement>(null);

  useEffect(() => {
    if (
      tagRef.current &&
      isSelected === true &&
      needsScrollingIntoView(tagRef, theme)
    ) {
      if (movedSelectedUp === true) {
        tagRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'start',
        });
      } else {
        tagRef.current?.scrollIntoView({
          behavior: 'auto',
          block: 'end',
        });
      }
    }
  }, [isSelected]);

  const [{isDragging}, drag, preview] = useDrag<
    DraggableItem,
    void,
    {isDragging: boolean}
  >(
    {
      item: (): DraggableItem => ({
        id,
        originalIndex,
        type: ItemTypes.TAG,
        index,
      }),
      type: ItemTypes.TAG,
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
          if (draggedItem?.type) {
            // Then it was dropped on something.
            if (draggedItem.type === 'tag') {
              // Then it was dropped on a tag. So we need to reorder the tags.
              if (originalIndex !== draggedItem.index) {
                console.debug(
                  `useDrag end: it moved from index ${originalIndex} to ${draggedItem.index}`
                );
                console.debug(
                  `useDrag end: draggedItem ID: ${draggedItem.id} originalIndex: ${draggedItem.originalIndex} index ${draggedItem.index}`
                );
                const {entry, index} = findEntry(draggedItem.id);
                const entryBelow = findEntryByIndex(index + 1);
                let orderedTop: ITagJsonApi | null;
                let orderedBottom: ITagJsonApi | null;
                if (entryBelow === null) {
                  //Then it was moved to the bottom position, get the entry before it.
                  orderedTop = findEntryByIndex(index - 1);
                  orderedBottom = entry;
                } else {
                  orderedTop = entry;
                  orderedBottom = entryBelow;
                }
                if (
                  orderedTop !== null &&
                  orderedBottom !== null &&
                  session !== null
                ) {
                  await reorderTags(
                    session,
                    orderedTop.id,
                    orderedBottom.id
                  ).catch((error: unknown) => {
                    console.error('Failed to reorder tags:', error);
                  });
                }
              } else {
                console.debug('useDrag end: it was not moved within the list.');
              }
            }
          }
        }
      },
    },
    [id, originalIndex, moveEntry, readOnly]
  );

  const [{canDrop, isOver}, drop] = useDrop<
    DraggableItem,
    DropResult,
    DroppableItem
  >(
    () => ({
      accept: [ItemTypes.TAG, ItemTypes.ENTRY, ItemTypes.UNTAGGEDENTRY],
      canDrop: () => {
        return true;
      },
      drop: (): DraggableItem => ({
        id,
        type: 'Tag',
        index,
        originalIndex,
      }),
      collect: monitor => ({
        isOver: monitor.isOver(),
        canDrop: monitor.canDrop(),
      }),
      hover: (item: DraggableItem, monitor) => {
        console.debug(`hover: index ${index} originalIndex ${originalIndex}`);
        if (!dragRef.current) {
          return;
        }
        if (
          item.type === ItemTypes.ENTRY ||
          item.type === ItemTypes.UNTAGGEDENTRY
        ) {
          return;
        }

        const dragIndex = item.index;
        const hoverIndex = index;
        if (dragIndex === hoverIndex) {
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
    }),
    [findEntry, moveEntry]
  );

  const mouseEnter = () => {
    if (
      appConfig.loggedInUser !== null &&
      !readOnly &&
      appConfig.tagSortOrder === 'order'
    ) {
      setShowDragHandle(true);
    }
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
  };

  const [mouse, setMouse] = useState(initialMouse);
  const [isEditing, setIsEditing] = useState(false);

  const handleCancelEdit = () => {
    setIsEditing(false);
  };

  // The tag shown follows its new name.
  const handleSave = (renamed: ITagJsonApi) => {
    setIsEditing(false);
    if (shownTag === tagObject.attributes.name) {
      navigate(`/${user}/${renamed.attributes.name}`, {replace: true});
    }
  };

  const deleteTag = () => {
    if (session === null) {
      return;
    }
    deleteStoredTag(session, tagObject.id).catch((error: unknown) => {
      console.error('Failed to delete tag:', error);
    });
  };

  const handleBeginEdit = () => {
    setIsEditing(true);
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    mouseData.mouseX = event.clientX - 2;
    mouseData.mouseY = event.clientY - 4;
    setMouse(mouseData);
  };

  const opacity = isDragging ? 0 : 1;

  const dragHandleRef = (el: HTMLDivElement | null) => {
    dragRef.current = el;
    drag(el);
  };

  const dropBoxRef = (el: HTMLDivElement | null) => {
    dropRef.current = el;
    drop(el);
  };

  const previewRef = (el: HTMLDivElement | null) => {
    preview(el);
  };

  const contextMenu = useMemo(
    () => (
      <TagContextMenu
        id={id}
        mouse={mouse}
        deleteTagParent={deleteTag}
        handleBeginEditParent={handleBeginEdit}
      />
    ),
    [mouse]
  );

  const handleTagClick = (object: ITagJsonApi): void => {
    navigate(`/${user}/${object.attributes.name}`);
    // Reset the main panel in case Untagged Entries were being viewed.
    appConfig.setAppMode(appMode.tagsList);
    appConfig.incrementClickCount();
    appConfig.setActiveSearch(activeSearch.entries);
    appConfig.setEntrySearchString('');
    appConfig.setTagSelectedID(object.id);
    setSelectedTag(object.id);
  };

  const isActiveHover = canDrop && isOver;
  let backgroundColor = theme.palette.background.default;
  if (isActiveHover) {
    backgroundColor = theme.palette.action.hover;
  } else if (isSelected) {
    backgroundColor = theme.selected.background;
  }

  const dropLabelRef = (el: HTMLDivElement | null) => {
    drop(el);
  };

  return (
    <>
      {!isEditing && (
        <ListItem
          key={object.id}
          sx={{
            padding: 0,
          }}
          ref={tagRef}
        >
          <ListItemButton
            data-testid={`tagListButton-${object.id}`}
            sx={{
              padding: 0,
            }}
          >
            <Box
              ref={dropBoxRef}
              style={{opacity}}
              onContextMenu={readOnly ? undefined : handleContextClick}
              onClick={() => {
                handleTagClick(object);
              }}
              id={`tag-${id}`}
              data-testid={`tag-${id}`}
              role="tag"
              aria-current={isSelected ? 'true' : undefined}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
              sx={{
                width: '100%',
                backgroundColor,
                '&:hover': {
                  backgroundColor: theme.palette.action.hover,
                },
              }}
            >
              <TagContainer ref={previewRef}>
                <DragHandleContainer role="tagDragHandleContainer">
                  <DragHandle
                    role="tagDragHandle"
                    ref={dragHandleRef}
                    style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
                  >
                    ::
                  </DragHandle>
                </DragHandleContainer>
                <TagLabelWrapper
                  id={`tagLabelWrapper-${id}`}
                  role="tagLabelWrapper"
                  ref={dropLabelRef}
                >
                  <TagLabel label={tagObject.attributes.name} />
                  {appConfig.showTagCounts
                    ? ` (${tagObject.attributes.entry_count})`
                    : null}
                </TagLabelWrapper>
              </TagContainer>
            </Box>
          </ListItemButton>
        </ListItem>
      )}
      {appConfig.loggedInUser && !readOnly && <>{contextMenu}</>}
      {isEditing && !readOnly && (
        <TagEdit
          object={tagObject}
          handleSaveParent={handleSave}
          handleCancelEditParent={handleCancelEdit}
        />
      )}
    </>
  );
};

const memoizedTag = React.memo(Tag);

export {memoizedTag as Tag};
