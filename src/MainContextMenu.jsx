import React, {useEffect, useState } from 'react'
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

const MainContextMenu = React.memo(function MainContextMenu(props) {


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

  const handleShowNewEntry = () => {
    props.showNewEntry();
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
      <MenuItem onClick={() => { handleShowNewEntry();}}>New Entry</MenuItem>
    </Menu>
  )
})
export default MainContextMenu
