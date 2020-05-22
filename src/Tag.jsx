import React from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
const style = {
  width: '100%',
  marginRight: 0,
  marginBottom: 0,
  color: 'white',
  padding: 0,
  textAlign: 'left',
  fontSize: '1rem',
  lineHeight: 'normal',
  float: 'left',
}
const Tag = ({ name, id }) => {
  const [{ canDrop, isOver }, drop] = useDrop({
    accept: ItemTypes.ENTRY,
    drop: () => ({ 
      name: name, 
      id: id, 
      type: 'Tag' }),
    collect: (monitor) => ({
      isOver: monitor.isOver(),
      canDrop: monitor.canDrop(),
    }),
  })
  const isActive = canDrop && isOver
  let backgroundColor = 'black'
  if (isActive) {
    backgroundColor = 'white'
  } else if (canDrop) {
    backgroundColor = 'gray'
  }
  return (
    <div ref={drop} style={{ ...style, backgroundColor }}>
      {isActive ? 'Release to drop' : name}
    </div>
  )
}
export default Tag