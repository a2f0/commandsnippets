import React, {useEffect, useState} from 'react';
import {IMouse} from './Entry';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import Menu from '@mui/material/Menu';
import {MenuStyle} from './MenuBar';
import StyledMenuItem from './StyledMenuItem';
import {WithStyles} from '@mui/styles';
import withStyles from '@mui/styles/withStyles';

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

export interface IEntryContextMenu {
  mouse: IMouse;
  id: string;
  text_entry: ITextEntryJsonApi;
  handleRemoveFromListParent: () => void;
  handleNewEntryParent: () => void;
  handleBeginEditParent: () => void;
  handleCopyParent: () => void;
}

const EntryContextMenu = ({
  mouse,
  id,
  handleRemoveFromListParent,
  handleNewEntryParent,
  handleBeginEditParent,
  handleCopyParent,
}: IEntryContextMenu) => {
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

  const handleRemoveFromList = () => {
    handleRemoveFromListParent();
    handleClose();
  };

  const handleBeginEdit = () => {
    handleBeginEditParent();
    handleClose();
  };

  const handleNewEntry = () => {
    handleNewEntryParent();
    handleClose();
  };

  const handleCopy = () => {
    handleCopyParent();
    handleClose();
  };

  return (
    <StyledMenu
      id={`tagsEntriesContextMenu-${id}`}
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
        onClick={() => {
          handleCopy();
        }}
      >
        Copy
      </StyledMenuItem>
      <StyledMenuItem
        onClick={(event: React.MouseEvent<HTMLLIElement>) => {
          event.preventDefault();
          event.stopPropagation();
          handleBeginEdit();
        }}
      >
        Edit
      </StyledMenuItem>
      <StyledMenuItem
        onClick={(event: React.MouseEvent<HTMLLIElement>) => {
          event.preventDefault();
          event.stopPropagation();
          handleNewEntry();
        }}
      >
        New Entry
      </StyledMenuItem>
      <StyledMenuItem
        onClick={() => {
          handleRemoveFromList();
        }}
      >
        Untag
      </StyledMenuItem>
    </StyledMenu>
  );
};
export default React.memo(EntryContextMenu);
