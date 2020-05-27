import React, { useRef } from 'react'
import { useDrag, useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'

import { makeStyles } from '@material-ui/core/styles';

import DragIndicatorIcon from '@material-ui/icons/DragIndicator';

const useStyles = makeStyles({
  dragIndicator: {
    display: 'inline-block',
    cursor: 'move',
    verticalAlign: 'top'
  },
  entry: {
    display: 'inline-block',
    verticalAlign: 'top'
  },
  entryWrapper: {
    backgroundColor: 'black',
    marginBottom: 16,
    "&:hover": {
      color: "white"
    },
    "&:active": {
      color: "white"
    },
  },
  entrySubject: {

  },
  entryBody: {
    fontSize: 14,
    fontFamily: 'monospace',
    whiteSpace: 'pre-wrap',
  }
});

const Entry = ({ id, index, subject, body, moveEntry, findEntry }) => {
  const dragRef = useRef(null)
  const dropRef = useRef(null)
  const originalIndex = findEntry(id).index
  const [{ isDragging }, drag, preview] = useDrag({
    item: { type: ItemTypes.ENTRY, id, index },
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
            console.info("it was dropped on a tag.")
          }
        } else {
          // Then it was reordered in the list.
          if (originalIndex != findEntry(id).index ) {
            console.log("it moved")
          }
        }
      }
    },
  })
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

  const opacity = isDragging ? 0 : 1

  const classes = useStyles();
  drag(dragRef)
  drop(dropRef)
  return (
    <div ref={(dropRef)}style={{opacity}}>
      <div ref={(preview)} className={classes.entryWrapper}>
        <div ref={(dragRef)} className={classes.dragIndicator}>
          <DragIndicatorIcon/>
        </div>
        <div className={classes.entry}>
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
}
export default Entry
