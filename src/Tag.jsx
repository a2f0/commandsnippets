import React from 'react'
import { useDrop } from 'react-dnd'
import ItemTypes from './ItemTypes'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import { useTheme } from '@material-ui/styles';


const style = {
  marginRight: 0,
  marginBottom: 0,
  padding: 0,
  textAlign: 'left',
  fontSize: '12',
  lineHeight: 'normal',
  float: 'left'
}
const Tag = React.memo(function Tag({name, id}) {
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

  const initialState = {
    mouseX: null,
    mouseY: null,
  };

  const [state, setState] = React.useState(initialState);

  const handleContextClick = (event) => {
    event.preventDefault();
    setState({
      mouseX: event.clientX - 2,
      mouseY: event.clientY - 4,
    });
  };

  const handleClose = () => {
    setState(initialState);
  };

  return (
    <>
      <div
        ref={drop}
        style={{ ...style, backgroundColor }}
        onClick={handleTagClick}
        onContextMenu={handleContextClick}>
        {isActive ? name : name}
      </div>
      {/* <Menu
        keepMounted
        open={state.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          state.mouseY !== null && state.mouseX !== null
            ? { top: state.mouseY, left: state.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={handleClose}>New Tag</MenuItem>
        <MenuItem onClick={handleClose}>Delete Tag</MenuItem>
        <MenuItem onClick={handleClose}>Delete Tag and sll Entries</MenuItem>
      </Menu> */}
    </>
    
  )
})
export default Tag