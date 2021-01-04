import React, {useEffect, useState } from 'react'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import API from './api.js'

const UntaggedEntryContextMenu = React.memo(function EntryContextMenu(props) {


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

  const handleDelete = () => {
    props.handleDelete();
    handleClose();
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
      <MenuItem onClick={() => { handleDelete();}}>Delete</MenuItem>
    </Menu>
  )
})
export default UntaggedEntryContextMenu
