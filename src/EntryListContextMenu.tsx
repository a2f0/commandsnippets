import React, {useEffect, useState} from 'react';
import {IMouse} from './Entry';
import Menu from '@material-ui/core/Menu';
import StyledMenuItem from './StyledMenuItem';

export interface IEntryContextMenu {
  mouse: IMouse;
}

const EntryListContextMenu = ({mouse}: IEntryContextMenu) => {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mousePosition, setMousePosition] = useState(initialMouse);

  useEffect(() => {
    setMousePosition(mouse);
  }, [mouse]);

  const handleClose = () => {
    setMousePosition(initialMouse);
  };

  const handleNewEntry = () => {
    handleClose();
  };

  return (
    <Menu
      id="tagsEntriesContextMenu"
      keepMounted
      open={mousePosition.mouseY !== null}
      onClose={handleClose}
      anchorReference="anchorPosition"
      anchorPosition={
        mousePosition.mouseY !== null && mousePosition.mouseX !== null
          ? {top: mousePosition.mouseY, left: mousePosition.mouseX}
          : undefined
      }
    >
      <StyledMenuItem
        onClick={() => {
          handleNewEntry();
        }}
      >
        New Entry
      </StyledMenuItem>
    </Menu>
  );
};
export default React.memo(EntryListContextMenu);
