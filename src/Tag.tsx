import {IMouse, initialMouse} from './lib/shared';
import React, {useMemo, useRef, useState} from 'react';
import {ReorderTag, tearleadsApi} from './lib/api/tearleadsApi';
import {activeSearch, appMode} from './lib/shared';
import {useDrag, useDrop} from 'react-dnd';
import {useNavigate, useParams} from 'react-router-dom';
import {AxiosResponse} from 'axios';
import {Box} from '@mui/material';
import DragHandle from './DragHandle';
import DragHandleContainer from './DragHandleContainer';
import type {ITag} from './lib/db/types';
import {ITagJsonApi} from './models/TagModel';
import {ITagJsonApiResponseSingle} from './lib/tags';
import ItemTypes from './ItemTypes';
import TagContextMenu from './TagContextMenu';
import TagEdit from './TagEdit';
import TagLabel from './TagLabel';
import {Theme} from '@mui/material/styles';
import apiBase from './lib/api/apiBase';
import {convertISO8601ToUnixTime} from './lib/util/dateTime';
import {observer} from 'mobx-react';
import {styled} from '@mui/material/styles';
import {useAppContext} from './AppContext';
import {useTheme} from '@mui/material/styles';

const TagContainer = styled('div')(() => ({
  whiteSpace: 'pre',
  lineHeight: '20px',
}));

interface ITagLabelWrapperProps {
  theme: Theme;
}

const TagLabelWrapper = styled('div')<ITagLabelWrapperProps>`
  display: inline-block;
  cursor: pointer;
  width: calc(100% - ${props => props.theme.main.dragIndicatorWidth}px);
  font-size: 14px;
`;

export interface DraggableItem {
  id: string;
  type: string;
  originalIndex: number;
  index: number;
}

interface DroppableItem {
  isOver: boolean;
  canDrop: boolean;
}

interface DropResult {
  id: string;
  type: string;
}

interface ITagProps {
  id: string;
  object: ITag;
  handleDeleteParent: (object: ITagJsonApiResponseSingle) => void;
  moveEntry: (id: string, atIndex: number) => void;
  findEntry: (id: string) => {entry: ITagJsonApi; index: number};
  index: number;
  findEntryByIndex: (id: number) => ITagJsonApi | null;
}

const Tag = ({
  object,
  handleDeleteParent,
  moveEntry,
  findEntry,
  index,
  findEntryByIndex,
}: ITagProps) => {
  const {id} = object;
  const [tagObject, setTagObject] = useState<ITag>(object);
  const appConfig = useAppContext();
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const theme: Theme = useTheme();
  const {user} = useParams();
  const navigate = useNavigate();

  const [{isDragging}, drag, preview] = useDrag(
    {
      item: (): DraggableItem => ({
        id,
        originalIndex,
        type: ItemTypes.TAG,
        index,
      }),
      type: ItemTypes.TAG,
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
          moveEntry(droppedId, originalIndex);
        } else {
          if (draggedItem?.type) {
            if ('type' in draggedItem) {
              if (draggedItem.type === 'tag') {
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
                  if (orderedTop !== null && orderedBottom !== null) {
                    const payload: ReorderTag = {
                      data: {
                        type: 'Tag',
                        attributes: {
                          top: orderedTop.id,
                          bottom: orderedBottom.id,
                        },
                        relationships: {},
                      },
                    };
                    await tearleadsApi.reorderTag(payload);
                  }
                } else {
                  console.debug(
                    'useDrag end: it was not moved within the list.'
                  );
                }
              }
            }
          }
        }
      },
    },
    [id, originalIndex, moveEntry]
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
    if (appConfig.loggedInUser !== null && appConfig.tagSortOrder === 'order') {
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

  const handleSave = (object: ITagJsonApiResponseSingle) => {
    const existing = appConfig.tagsArray.find(o => o.id === object.data.id);
    existing?.update(object.data);

    const updated = convertISO8601ToUnixTime(
      object.data.attributes.date_updated
    );
    const tag: ITag = {
      id: object.data.id,
      name: object.data.attributes.name,
      entryCount: object.data.attributes.entry_count,
      updated,
      userId: object.data.relationships.user.data.id,
      synced: false,
      deleted: false,
    };

    setTagObject(tag);

    setIsEditing(false);
  };

  const deleteTag = () => {
    apiBase
      .delete('/tags/' + tagObject.id, {withCredentials: true})
      .then((response: AxiosResponse<ITagJsonApiResponseSingle>) => {
        handleDeleteParent(response.data);
      })
      .catch(error => {
        console.error(error);
      });
  };

  const handleBeginEdit = () => {
    setIsEditing(true);
  };

  const handleContextClick = (event: React.MouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const mouseData: IMouse = {...mouse};
    (mouseData.mouseX = event.clientX - 2),
      (mouseData.mouseY = event.clientY - 4),
      setMouse(mouseData);
  };

  const opacity = isDragging ? 0 : 1;
  drag(dragRef);
  drop(dropRef);

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

  const handleTagClick = (object: ITag): void => {
    navigate(`/${user}/${object.name}`);
    // Reset the main panel in case Untagged Entries were being viewed.
    appConfig.setAppMode(appMode.tagsList);
    appConfig.incrementClickCount();
    appConfig.setActiveSearch(activeSearch.entries);
    appConfig.setEntrySearchString('');
    appConfig.setTagSelectedID(object.id);
  };

  const isActiveHover = canDrop && isOver;
  let backgroundColor = theme.palette.background.default;
  if (isActiveHover) {
    backgroundColor = theme.palette.action.hover;
  } else if (id === appConfig.tagSelectedID) {
    backgroundColor = theme.selected.background;
  }

  return (
    <>
      {!isEditing && (
        <Box
          ref={dropRef}
          style={{opacity}}
          onContextMenu={handleContextClick}
          onClick={() => {
            handleTagClick(object);
          }}
          id={`tag-${id}`}
          data-testid={`tag-${id}`}
          role="tag"
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
          <TagContainer ref={preview}>
            <DragHandleContainer theme={theme} role="tagDragHandleContainer">
              <DragHandle
                role="tagDragHandle"
                ref={dragRef}
                style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
              >
                ::
              </DragHandle>
            </DragHandleContainer>
            <TagLabelWrapper
              theme={theme}
              id={`tagLabelWrapper-${id}`}
              role="tagLabelWrapper"
              ref={drop}
            >
              <TagLabel label={tagObject.name} />
              {appConfig.showTagCounts ? ` (${tagObject.entryCount})` : null}
            </TagLabelWrapper>
          </TagContainer>
        </Box>
      )}
      {appConfig.loggedInUser && <>{contextMenu}</>}
      {isEditing && (
        <TagEdit
          object={tagObject}
          handleSaveParent={handleSave}
          handleCancelEditParent={handleCancelEdit}
        />
      )}
    </>
  );
};

export default React.memo(observer(Tag));
