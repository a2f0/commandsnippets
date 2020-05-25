import React from 'react'
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
      color: "#FF00FF"
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

const Entry = ({ id, subject, body, moveEntry, findEntry }) => {
  const originalIndex = findEntry(id).index
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
      console.info('can drop');
    },
    hover({ id: draggedId }) {
      if (draggedId !== id) {
        console.log('moving entry')
        const { index: overIndex } = findEntry(id)
        moveEntry(draggedId, overIndex)
      }
    },
  })

  const opacity = isDragging ? 0 : 1

  const classes = useStyles();
  return (
    <div ref={(node) => drop(node)} style={{opacity }}>
      <div ref={(preview)} className={classes.entryWrapper}>
        <div ref={(node) => drag(node)} className={classes.dragIndicator}>
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
