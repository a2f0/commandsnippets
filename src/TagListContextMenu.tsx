import React, {useEffect, useState} from 'react';
import {IMouse} from './Entry';
import Menu from '@mui/material/Menu';
import {MenuStyle} from './MenuBar';
import StyledMenuItem from './StyledMenuItem';
import {WithStyles} from '@mui/styles';
import {appMode} from '../src/lib/shared';
import {useAppContext} from './AppContext';
import withStyles from '@mui/styles/withStyles';

interface ITagContextMenuProps {
  mouse: IMouse;
}

interface IStyledMenuProps extends WithStyles<typeof MenuStyle> {
  id: string;
  keepMounted: boolean;
  mousePosition: IMouse;
  open: boolean;
  onClose: () => void;
  anchorReference: 'anchorPosition';
  anchorPosition: {top: number; left: number} | undefined;
  classes: {
    paper: string;
    list: string;
  };
  children: React.ReactNode;
}

const StyledMenu = withStyles(MenuStyle)(
  ({
    id,
    keepMounted,
    mousePosition,
    open,
    onClose,
    anchorReference,
    classes,
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
        classes={classes}
      >
        {children}
      </Menu>
    );
  }
);

const TagListContextMenu = ({mouse}: ITagContextMenuProps) => {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

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
