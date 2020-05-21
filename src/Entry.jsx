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
const Entry = ({ id, text, moveEntry, findEntry }) => {
  const originalIndex = findEntry(id).index
  const [{ isDragging }, drag] = useDrag({
    item: { type: ItemTypes.ENTRY, id, originalIndex },
    collect: (monitor) => ({
      isDragging: monitor.isDragging(),
    }),
    end: (dropResult, monitor) => {
      console.log("dropped it")
      const { id: droppedId, originalIndex } = monitor.getItem()
      const didDrop = monitor.didDrop()
      if (!didDrop) {
        moveEntry(droppedId, originalIndex)
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
      {text}
    </div>
  )
}
export default Entry
