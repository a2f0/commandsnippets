import React from 'react'
import { useDrag, useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'

import { makeStyles } from '@material-ui/core/styles';

const useStyles = makeStyles({
  entry: {
    backgroundColor: 'black',
    cursor: 'move',
    marginBottom: 16,
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
  const [{ isDragging }, drag] = useDrag({
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
        const { index: overIndex } = findEntry(id)
        moveEntry(draggedId, overIndex)
      }
    },
  })

  const opacity = isDragging ? 0 : 1

  const classes = useStyles();
  return (
    <div ref={(node) => drag(drop(node))} style={{opacity }} className={classes.entry}  >
      <div className={classes.entrySubject}>
        {subject}
      </div>
      <div className={classes.entryBody}>
        {body}
      </div>
    </div>
  )
}
export default Entry
