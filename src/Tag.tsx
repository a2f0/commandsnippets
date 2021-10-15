import * as Constants from './constants';
import React, {useMemo, useRef, useState} from 'react';
import {useDrag, useDrop} from 'react-dnd';
import API from './api';
import {IMouse} from './Entry';
import {ITagJsonApi} from './models/TagModel';
import {Instance} from 'mobx-state-tree';
import ItemTypes from './ItemTypes';
import TagContextMenu from './TagContextMenu';
import TagEdit from './TagEdit';
import {TagModel} from './models/TagModel';
import {TagTextEntryThroughModel} from './EntryList';
import {Theme} from '@material-ui/core/styles';
import {makeStyles} from '@material-ui/core/styles';
import {useAppContext} from './AppContext';
import {useHistory} from 'react-router-dom';
import {useParams} from 'react-router-dom';
import {useTheme} from '@material-ui/styles';

const useStyles = makeStyles({
  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryWrapper: {
    whiteSpace: 'pre',
  },
  tagLabel: {
    display: 'inline-block',
    cursor: 'pointer',
    width: '100%',
  },
  tagDragIndicatorContainer: {
    display: 'inline-block',
    fontWeight: 900,
    textAlign: 'center',
    width: `${Constants.dragIndicatorWidthTag}px`,
  },
  tagDragIndicator: {
    cursor: 'grab',
  },
});

interface ITagProps {
  id: string;
  object: ITagJsonApi;
  moveEntry: (id: string, atIndex: number) => void;
  findEntry: (id: string) => {entry: ITagJsonApi; index: number};
  index: number;
  findEntryByIndex: (id: number) => ITagJsonApi | null;
}

interface IParamTypes {
  user: string;
}

const Tag = ({
  id,
  object,
  moveEntry,
  findEntry,
  index,
  findEntryByIndex,
}: ITagProps) => {
  const appConfig = useAppContext();
  const dragRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<HTMLDivElement>(null);
  const classes = useStyles();
  const history = useHistory();
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const theme: Theme = useTheme();
  const {user} = useParams<IParamTypes>();
  const [{canDrop, isOver}, drop] = useDrop({
    accept: [ItemTypes.TAG, ItemTypes.ENTRY, ItemTypes.UNTAGGEDENTRY],
    canDrop: () => {
      return true;
    },
    drop: () => ({
      //name: name,
      id: id,
      type: 'Tag',
    }),
    collect: monitor => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
    hover(item: TagTextEntryThroughModel, monitor) {
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
  });
  const isActive = canDrop && isOver;
  let backgroundColor = theme.palette.background.paper;
  if (isActive) {
    backgroundColor = 'white';
  } else if (canDrop) {
    backgroundColor = 'gray';
  }

  const handleTagClick = () => {
    appConfig.setMainPanel('EntryList');
    history.push(`/${user}/${object.attributes.name}`);
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

  const handleSaveParent = () => {
    setIsEditing(false);
  };

  const deleteTag = () => {
    API.delete('/tags/' + object.id, {withCredentials: true})
      .then(() => {
        //object.remove();
      })
      .catch(error => {
        // handle error
        console.log(error);
      })
      .then(() => {
        // always executed
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
    item: () => ({id, originalIndex, type: ItemTypes.TAG}),
    type: ItemTypes.TAG,
    collect: monitor => ({
      isDragging: monitor.isDragging(),
    }),
    end: (dropResult, monitor) => {
      const drop_result: ITagJsonApi | null = monitor.getDropResult();
      const {id: droppedId, originalIndex} = monitor.getItem();
      const didDrop = monitor.didDrop();
      if (!didDrop) {
        console.info('didDrop Tag moveEntry');
        moveEntry(droppedId, originalIndex);
      } else {
        console.info('didDrop Tag');
        if (drop_result?.type) {
          if ('type' in drop_result) {
            if (drop_result.type === 'Tag') {
              // Then it was reordered in the list.
              if (originalIndex !== findEntry(id).index) {
                console.info(
                  'it moved from index ' +
                    originalIndex +
                    ' to ' +
                    findEntry(id).index
                );
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
                  const payload = {
                    data: {
                      type: 'Tag',
                      attributes: {
                        top: ordered_top.id,
                        bottom: ordered_bottom.id,
                      },
                      relationships: {},
                    },
                  };
                  API.post('/tags/reorder', payload, {withCredentials: true})
                    .then(() => {})
                    .catch(() => {
                      // handle error
                    })
                    .then(() => {
                      // always executed
                    });
                }
              } else {
                console.info("it wasn't moved.");
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
        deleteTag={deleteTag}
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
        >
          <div ref={preview} className={classes.entryWrapper}>
            <div
              className={classes.tagDragIndicatorContainer}
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
            >
              <div
                ref={dragRef}
                className={classes.tagDragIndicator}
                onMouseEnter={mouseEnter}
                onMouseLeave={mouseLeave}
                style={{visibility: showDragHandle ? 'visible' : 'hidden'}}
              >
                ::
              </div>
            </div>
            <div
              onMouseEnter={mouseEnter}
              onMouseLeave={mouseLeave}
              ref={drop}
              className={classes.tagLabel}
              style={{backgroundColor}}
              onClick={handleTagClick}
              onContextMenu={handleContextClick}
            >
              {object.attributes.name}
              {appConfig.showTagCounts
                ? ` (${object.attributes.entry_count})`
                : null}
            </div>
          </div>
        </div>
      )}
      {appConfig.loggedInUser && <>{contextMenu}</>}
      {isEditing && (
        <TagEdit
          object={object}
          handleSaveParent={handleSaveParent}
          handleCancelEdit={handleCancelEdit}
        />
      )}
    </>
  );
};
export default React.memo(Tag);
