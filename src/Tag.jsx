import React from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'

const style = {
  marginRight: 0,
  marginBottom: 0,
  color: 'white',
  padding: 0,
  textAlign: 'left',
  fontSize: '12',
  lineHeight: 'normal',
  float: 'left'
}
const Tag = React.memo(function Tag({name, id}) {
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

  const handleTagClick = () => {
    console.log('handle it')
  }

  return (
    <div ref={drop} style={{ ...style, backgroundColor }} onClick={handleTagClick}>
      {isActive ? name : name}
    </div>
  )
})
export default Tag