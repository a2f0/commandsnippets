import {Menu} from '@mui/material';
import {MenuItem} from '@mui/material';
import React, {useEffect, useState} from 'react';

import {type IMouse, initialMouse} from './lib/shared';

interface IMainContextMenu {
  mouse: IMouse;
  showNewEntry: () => void;
}

const MainContextMenu = (props: IMainContextMenu) => {
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
          : {top: 0, left: 0}
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
