import React, {useState} from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { useTheme } from '@material-ui/styles';
import TagContextMenu from './TagContextMenu.jsx'


const style = {
  marginRight: 0,
  marginBottom: 0,
  padding: 0,
  textAlign: 'left',
  fontSize: '12',
  lineHeight: 'normal',
  float: 'left'
}
const Tag = React.memo(function Tag({tag, id, user}) {
  const theme = useTheme();
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
  let backgroundColor = theme.palette.background.paper
  if (isActive) {
    backgroundColor = 'white'
  } else if (canDrop) {
    backgroundColor = 'gray'
  }

  const handleTagClick = () => {
    console.log('handle it')
  }

  const initialMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);

  const handleContextClick = (event) => {
    event.preventDefault();
    let mouseData = {...mouse}
    mouseData.mouseX = event.clientX - 2,
    mouseData.mouseY = event.clientY - 4,
    setMouse(mouseData)
  };

  return (
    <>
      <div
        ref={drop}
        style={{ ...style, backgroundColor }}
        onClick={handleTagClick}
        onContextMenu={handleContextClick}>
        {isActive ? tag.attributes.name : tag.attributes.name}
      </div>
      <TagContextMenu mouse={mouse}/>
    </>
  )
})
export default Tag