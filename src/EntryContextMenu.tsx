import React, {useEffect, useState} from 'react';
import {IMouse} from './Entry';
import {ITextEntryJsonApi} from './models/TextEntryModel';
import Menu from '@mui/material/Menu';
import StyledMenuItem from './StyledMenuItem';

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
        id={`tags-entries-context-menu-${id}-copy`}
        onClick={() => {
          handleCopy();
        }}
      >
        Copy
      </StyledMenuItem>
      <StyledMenuItem
        id={`tagsEntriesContextMenu${id}Edit`}
        onClick={(event: React.MouseEvent<HTMLLIElement>) => {
          event.preventDefault();
          event.stopPropagation();
          handleBeginEdit();
        }}
      >
        Edit
      </StyledMenuItem>
      <StyledMenuItem
        id={`tags-entries-context-menu-${id}-new-entry`}
        onClick={(event: React.MouseEvent<HTMLLIElement>) => {
          event.preventDefault();
          event.stopPropagation();
          handleNewEntry();
        }}
      >
        New Entry
      </StyledMenuItem>
      <StyledMenuItem
        id={`tags-entries-context-menu-${id}-untag`}
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
