import React, {useEffect, useState, setState} from 'react'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

const TagContextMenu = React.memo(function TagContextMenu(props) {
  
  const initialMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState(initialMouse);
  
  useEffect(() => {
    setMouse(props.mouse)
  }, [props.mouse]);

  const handleClose = () => {
    setMouse(initialMouse);
  };

  return (
    <Menu
      keepMounted
      open={mouse.mouseY !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mouse.mouseY !== null && mouse.mouseX !== null
          ? { top: mouse.mouseY, left: mouse.mouseX }
          : undefined
      }
    >
      <MenuItem onClick={handleClose}>New Tag</MenuItem>
      <MenuItem onClick={handleClose}>Delete Tag</MenuItem>
      <MenuItem onClick={handleClose}>Delete Tag and all Entries</MenuItem>
    </Menu>    
  )
})
export default TagContextMenu