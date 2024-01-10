import React, {useMemo, useRef, useState} from 'react';
import {ReorderTag, tearleadsApi} from './lib/api/tearleadsApi';
import {activeSearch, appMode} from './lib/shared';
import {useDrag, useDrop} from 'react-dnd';
import {AxiosResponse} from 'axios';
import DragHandle from './DragHandle';
import DragHandleContainer from './DragHandleContainer';
import {IMouse} from './Entry';
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
import {useNavigate} from 'react-router-dom';
import {useParams} from 'react-router-dom';
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
  moveEntry: (dragIndex: number, atIndex: number) => void;
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
  const navigate = useNavigate();
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const theme: Theme = useTheme();
  const {user} = useParams();
  const [{canDrop, isOver}, drop] = useDrop<
    DraggableItem,
    DropResult,
    DroppableItem
  >(() => ({
    accept: [ItemTypes.TAG, ItemTypes.ENTRY, ItemTypes.UNTAGGEDENTRY],
    canDrop: () => {
      return true;
    },
    drop: () => ({
      id,
      type: 'Tag',
    }),
    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    hover: (item: DraggableItem, monitor) => {
      console.debug('hover (tag)');
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

        const {index} = findEntry(item.id);
        moveEntry(index, hoverIndex);
        // Note: we're mutating the monitor item here!
        // Generally it's better to avoid mutations,
        // but it's good here for the sake of performance
        // to avoid expensive index searches.
        item.index = hoverIndex;
      }
    },
  }));

  const isActiveHover = canDrop && isOver;

  const tagStyle = {
    backgroundColor: theme.palette.background.paper,
    color: theme.palette.text.primary,
  };

  if (
    (id === appConfig.tagSelectedID &&
      appConfig.appMode === appMode.tagsList) ||
    isActiveHover
  ) {
    tagStyle.backgroundColor = theme.selected.background;
    tagStyle.color = theme.selected.foreground;
  }

  const handleTagClick = () => {
    navigate(`/${user}/${tagObject.name}`);
    // Reset the main panel in case Untagged Entries were being viewed.
    appConfig.setAppMode(appMode.tagsList);
    appConfig.incrementClickCount();
    appConfig.setActiveSearch(activeSearch.entries);
    appConfig.setEntrySearchString('');
    appConfig.setTagSelectedID(tagObject.id);
  };

  const mouseEnter = () => {
    if (appConfig.loggedInUser !== null && appConfig.tagSortOrder === 'order') {
      setShowDragHandle(true);
    }
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
  };

  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
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

  const [{isDragging}, drag, preview] = useDrag({
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
    end: async (dropResult, monitor) => {
      const drop_result: ITagJsonApi | null = monitor.getDropResult();
      const {id: droppedId, originalIndex} = monitor.getItem();
      const didDrop = monitor.didDrop();
      if (!didDrop) {
        console.info('didDrop Tag moveEntry');
        const {index} = findEntry(droppedId);
        moveEntry(index, originalIndex);
      } else {
        if (drop_result?.type) {
          if ('type' in drop_result) {
            if (drop_result.type === 'Tag') {
              console.info(`originalIndex: ${originalIndex}`);
              console.info(`findEntryIndex: ${findEntry(id).index}`);
              if (originalIndex !== dropResult.index) {
                console.info(
                  `it moved from index ${originalIndex} to ${index} (tags)`
                );
                // Then it was reordered in the list.
                const entry = findEntry(id).entry;
                const entry_below = findEntryByIndex(index + 1);
                let ordered_top: ITagJsonApi | null;
                let ordered_bottom: ITagJsonApi | null;
                if (entry_below === null) {
                  //Then it was moved to the bottom position, get the entry before it.
                  ordered_top = findEntryByIndex(index - 1);
                  ordered_bottom = entry;
                } else {
                  ordered_top = entry;
                  ordered_bottom = entry_below;
                }
                if (ordered_top !== null && ordered_bottom !== null) {
                  const payload: ReorderTag = {
                    data: {
                      type: 'Tag',
                      attributes: {
                        top: ordered_top.id,
                        bottom: ordered_bottom.id,
                      },
                      relationships: {},
                    },
                  };
                  await tearleadsApi.reorderTag(payload);
                }
              } else {
                console.info("it wasn't moved within the list (tag)");
              }
            }
          }
        }
      }
    },
  });
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

  return (
    <>
      {!isEditing && (
        <div
          ref={dropRef}
          style={{opacity}}
          onContextMenu={handleContextClick}
          id={`tag-${id}`}
          role="tag"
        >
          <TagContainer ref={preview}>
            <DragHandleContainer
              theme={theme}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
              role="tagDragHandleContainer"
            >
              <DragHandle
                role="tagDragHandle"
                ref={dragRef}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
                style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
              >
                ::
              </DragHandle>
            </DragHandleContainer>
            <TagLabelWrapper
              theme={theme}
              id={`tagLabelWrapper-${id}`}
              role="tagLabelWrapper"
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
              ref={drop}
              style={tagStyle}
              onClick={handleTagClick}
              onContextMenu={handleContextClick}
            >
              <TagLabel label={tagObject.name} />
              {appConfig.showTagCounts ? ` (${tagObject.entryCount})` : null}
            </TagLabelWrapper>
          </TagContainer>
        </div>
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
