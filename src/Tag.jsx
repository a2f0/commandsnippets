import React, {useRef, useState, useMemo} from 'react';
import {useDrag, useDrop} from 'react-dnd';
import ItemTypes from './ItemTypes.ts';
import {useTheme} from '@material-ui/styles';
import TagContextMenu from './TagContextMenu.jsx';
import {useAppContext} from './AppContext.tsx';
import {useHistory} from 'react-router-dom';
import API from './api.ts';
import {makeStyles} from '@material-ui/core/styles';
import * as Constants from './constants.ts';

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

const Tag = React.memo(function Tag({
  tag,
  id,
  user,
  fetchTags,
  moveEntry,
  findEntry,
  index,
  findEntryByIndex,
}) {
  const dragRef = useRef(null);
  const dropRef = useRef(null);
  const classes = useStyles();
  const originalIndex = findEntry(id).index;
  const [showDragHandle, setShowDragHandle] = useState(false);
  const theme = useTheme();
  const opacity = isDragging ? 0 : 1;

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
    hover(item, monitor) {
      if (!dragRef.current) {
        return;
      }

      if (item.type === 'entry') {
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
    },
  });
  const isActive = canDrop && isOver;
  let backgroundColor = theme.palette.background.paper;
  if (isActive) {
    backgroundColor = 'white';
  } else if (canDrop) {
    backgroundColor = 'gray';
  }

  const appConfig = useAppContext();
  const history = useHistory();

  const handleTagClick = () => {
    appConfig.mainPanel = 'EntryList';
    history.push(`/${user.attributes.username}/${tag.attributes.name}`);
  };

  const mouseEnter = () => {
    if (
      appConfig.appStateStore.loggedInUser !== '' &&
      appConfig.appStateStore.tagSortOrder === 'order'
    ) {
      setShowDragHandle(true);
    }
  };
  const mouseLeave = () => {
    setShowDragHandle(false);
  };

  const initialMouse = {
    mouseX: null,
    mouseY: null,
  };

  const deleteTag = () => {
    API.delete('/tags/' + tag.id, {withCredentials: true})
      .then(function () {
        fetchTags();
      })
      .catch(function (error) {
        // handle error
        console.log(error);
      })
      .then(function () {
        // always executed
      });
  };

  const [mouse, setMouse] = useState(initialMouse);

  const handleContextClick = event => {
    event.preventDefault();
    const mouseData = {...mouse};
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
      const drop_result = monitor.getDropResult();
      const {id: droppedId, originalIndex} = monitor.getItem();
      const didDrop = monitor.didDrop();
      if (!didDrop) {
        console.info('didDrop Tag moveEntry');
        moveEntry(droppedId, originalIndex);
      } else {
        console.info('didDrop Tag');
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
              let ordered_top;
              let ordered_bottom;
              if (entry_below === null) {
                //Then it was moved to the bottom position, get the entry before it.
                ordered_top = findEntryByIndex(index - 1);
                ordered_bottom = entry;
              } else {
                ordered_top = entry;
                ordered_bottom = entry_below;
              }
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
                .then(function () {})
                .catch(function () {
                  // handle error
                })
                .then(function () {
                  // always executed
                });
            } else {
              console.info("it wasn't moved.");
            }
          }
        }
      }
    },
  });

  drag(dragRef);
  drop(dropRef);

  const contextMenu = useMemo(
    () => <TagContextMenu mouse={mouse} deleteTag={deleteTag} />,
    [mouse]
  );

  return (
    <>
      <div ref={dropRef} style={{opacity}} onContextMenu={handleContextClick}>
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
            {isActive ? tag.attributes.name : tag.attributes.name}{' '}
            {tag.attributes.entry_count}
          </div>

          {appConfig.appStateStore.loggedInUser && <>{contextMenu}</>}
        </div>
      </div>
    </>
  );
});
export default Tag;
