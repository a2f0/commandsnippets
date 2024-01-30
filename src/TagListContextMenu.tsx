import {IMouse, initialMouse} from '../src/lib/shared';
import React, {useEffect, useState} from 'react';
import {Menu} from '@mui/material';
import StyledMenuItem from './StyledMenuItem';
import {appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';

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
          : undefined
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
export default React.memo(TagListContextMenu);
