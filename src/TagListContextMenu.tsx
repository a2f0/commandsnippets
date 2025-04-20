import {Menu} from '@mui/material';
import React, {useEffect, useState} from 'react';

import {type IMouse, initialMouse} from '../src/lib/shared';
import {appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import {StyledMenuItem} from './StyledMenuItem';

interface ITagContextMenuProps {
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

const TagListContextMenu = ({mouse}: ITagContextMenuProps) => {
  const appConfig = useAppContext();

  const [mousePosition, setMousePosition] = useState<IMouse>(initialMouse);

  useEffect(() => {
    setMousePosition(mouse);
  }, [mouse]);

  const handleClose = () => {
    setMousePosition(initialMouse);
  };

  const handleNewTag = () => {
    appConfig.setTagNew('bottom');
    appConfig.setAppMode(appMode.tagEditor);
    setMousePosition(initialMouse);
  };

  return (
    <>
      <StyledMenu
        id="tagListContextMenu"
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
        <StyledMenuItem id="tagListContextMenuNew" onClick={handleNewTag}>
          New Tag
        </StyledMenuItem>
      </StyledMenu>
    </>
  );
};

const memoizedTagListContextMenu = React.memo(TagListContextMenu);
export {memoizedTagListContextMenu as TagListContextMenu};
