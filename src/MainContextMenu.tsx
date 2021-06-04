import React, {useEffect, useState} from 'react';
import {IMouse} from './Entry';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';

interface IMainContextMenu {
  mouse: IMouse;
  showNewEntry: () => void;
}

const MainContextMenu = (props: IMainContextMenu) => {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState<IMouse>(initialMouse);

  useEffect(() => {
    setMouse(props.mouse);
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
          ? {top: mouse.mouseY, left: mouse.mouseX}
          : undefined
      }
    >
      <MenuItem
        onClick={() => {
          handleShowNewEntry();
        }}
      >
        New Entry
      </MenuItem>
    </Menu>
  );
};
export default React.memo(MainContextMenu);
