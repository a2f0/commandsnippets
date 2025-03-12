import {Menu} from '@mui/material';
import React, {useEffect, useState} from 'react';

import {IMouse} from '../src/lib/shared';
import {appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import StyledMenuItem from './StyledMenuItem';

export interface IEntryContextMenu {
  mouse: IMouse;
}

interface IStyledMenuProps {
  id: string;
  keepMounted: boolean;
  mousePosition: IMouse;
  open: boolean;
  onClose: () => void;
  anchorReference: 'anchorPosition';
  anchorPosition: {top: number; left: number} | undefined;
  children: React.ReactNode;
}

const StyledMenu = ({
  id,
  keepMounted,
  mousePosition,
  open,
  onClose,
  anchorReference,
  children,
}: IStyledMenuProps) => {
  return (
    <Menu
      id={id}
      keepMounted={keepMounted}
      open={open}
      onClose={onClose}
      anchorReference={anchorReference}
      anchorPosition={
        mousePosition.mouseY !== null && mousePosition.mouseX !== null
          ? {top: mousePosition.mouseY, left: mousePosition.mouseX}
          : {top: 0, left: 0}
      }
    >
      {children}
    </Menu>
  );
};

const EntryListContextMenu = ({mouse}: IEntryContextMenu) => {
  const appConfig = useAppContext();
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

  const handleNewEntry = (event: React.MouseEvent<HTMLLIElement>) => {
    event.preventDefault();
    event.stopPropagation();
    appConfig.setAppMode(appMode.entryEditor);
    appConfig.setEntryNew('textEntry-bottom');
    handleClose();
  };

  return (
    <StyledMenu
      id="entryListContextMenu"
      keepMounted
      mousePosition={mousePosition}
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
        id="entryListContextMenuNewEntry"
        onClick={handleNewEntry}
      >
        New Entry
      </StyledMenuItem>
    </StyledMenu>
  );
};
export default React.memo(EntryListContextMenu);
