import React, { useRef, useState } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import { useTheme } from '@material-ui/styles';
import API from './api.js'
import { makeStyles } from '@material-ui/core/styles';
import DragIndicatorIcon from '@material-ui/icons/DragIndicator';

const useStyles = makeStyles({

  entry: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  entryWrapper: {
    marginBottom: 16,
    // "&:hover": {
    //   color: "white"
    // },
    // "&:active": {
    //   color: "white"
    // },
  },
  entrySubject: {

  },
  entryBody: {
    fontSize: 14,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  }
});

const Entry = React.memo(function ({ id, index, subject, body, moveEntry, findEntry }) {
  const dragRef = useRef(null)
  const dropRef = useRef(null)
  const originalIndex = findEntry(id).index
  const [showDragHandle, setShowDragHandle] = useState(false)
  const classes = useStyles();
  const theme = useTheme();
  const [{ isDragging }, drag, preview] = useDrag({
    item: { type: ItemTypes.ENTRY, id, originalIndex },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (dropResult, monitor) => {
      const drop_result = monitor.getDropResult()
      const { id: droppedId, originalIndex } = monitor.getItem()
      const didDrop = monitor.didDrop()
      if (!didDrop) {
        moveEntry(droppedId, originalIndex)
      } else {
        if ( "type" in drop_result ) {
          if ( drop_result.type === "Tag" ) {
            const payload = {
              'data': {
                'type': 'TagTextEntryThroughModel',
                'attributes': {},
                'relationships': {
                  'tag': {
                    'data': {
                      'type': 'Tag', 
                      'id': drop_result.id 
                    }
                  },
                  'text_entry': {
                    'data': {
                      'type': 'TextEntry',
                      'id': findEntry(id).entry.id
                    }
                  }
                }
              }
            }
            const response = API.post('tags_entries', payload);
          }
        } else {
          // Then it was reordered in the list.
          if (originalIndex != findEntry(id).index ) {
            console.info("it moved from index " + originalIndex + " to " + findEntry(id).index)
          } else {
            console.info("it wasn't moved.")
          }
        }
      }
    },
  })
  // Make sure opacity is above the useDrag call above
  const opacity = isDragging ? 0 : 1
  const [, drop] = useDrop({
    accept: ItemTypes.ENTRY,
    canDrop: () => {
    },
    hover(item, monitor) {
      if (!dragRef.current) {
        return
      }
      const dragIndex = item.index
      const hoverIndex = index
      if (dragIndex === hoverIndex) {
        return
      }
      // Determine rectangle on screen
      const hoverBoundingRect = dragRef.current?.getBoundingClientRect()
      // Get vertical middle
      const hoverMiddleY =
        (hoverBoundingRect.bottom - hoverBoundingRect.top) / 2
      // Determine mouse position
      const clientOffset = monitor.getClientOffset()
      // Get pixels to the top
      const hoverClientY = clientOffset.y - hoverBoundingRect.top

      // Only perform the move when the mouse has crossed half of the items height
      // When dragging downwards, only move when the cursor is below 50%
      // When dragging upwards, only move when the cursor is above 50%
      // Dragging downwards
      if (dragIndex < hoverIndex && hoverClientY < hoverMiddleY) {
        return
      }
      // Dragging upwards
      if (dragIndex > hoverIndex && hoverClientY > hoverMiddleY) {
        return
      }

      moveEntry(item.id, hoverIndex)
      // Note: we're mutating the monitor item here!
      // Generally it's better to avoid mutations,
      // but it's good here for the sake of performance
      // to avoid expensive index searches.
      item.index = hoverIndex
    },
  })

  drag(dragRef)
  drop(dropRef)

  const mouseEnter = () => {
    setShowDragHandle(true)
  }
  const mouseLeave = () => {
    setShowDragHandle(false)
  }

  return (
    <div ref={(dropRef)} style={{opacity}}>
      <div ref={(preview)} className={classes.entryWrapper}>
        <div
          ref={(dragRef)} 
          style={{...theme.custom.dragIndicator}}
          onMouseEnter={mouseEnter} 
          onMouseLeave={mouseLeave}>
          <DragIndicatorIcon
            style={{ visibility: showDragHandle ? "visible" : "hidden" }}
          />
        </div>
        <div className={classes.entry}
          onMouseEnter={mouseEnter}
          onMouseLeave={mouseLeave}>
          <div className={classes.entrySubject}>
            {subject} 
          </div>
          <div className={classes.entryBody}>
            {body}
          </div>
        </div>
      </div>
    </div>
  )
})
export default Entry
