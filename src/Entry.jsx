import React from 'react'
import { useDrag, useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
const style = {
  border: '1px dashed gray',
  padding: '0.5rem 1rem',
  marginBottom: '.5rem',
  backgroundColor: 'black',
  cursor: 'move',
}
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
          console.log('it was not dropped on a tag.');
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
  return (
    <div ref={(node) => drag(drop(node))} style={{ ...style, opacity }}>
      <div>
        {subject}
      </div>
      <div>
        {body}
      </div>
      
    </div>
  )
}
export default Entry
