import React, {useEffect, useState } from 'react'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import API from './api.js'

const EntryContextMenu = React.memo(function EntryContextMenu(props) {


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

  const handleUntag = (id) => {
    API.delete('/tags_entries/' + id , {withCredentials: true});
    props.handleDelete(id)
    handleClose();
  };

  const handleBeginEdit = () => {
    props.handleBeginEdit();
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
      <MenuItem onClick={() => { handleUntag( props.id );}}>Untag</MenuItem>
      <MenuItem onClick={() => { handleBeginEdit( );}}>Edit</MenuItem>
    </Menu>    
  )
})
export default EntryContextMenu