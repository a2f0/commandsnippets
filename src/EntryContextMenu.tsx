import {Menu} from '@mui/material';
import React, {useEffect, useState} from 'react';
import {useParams, useSearchParams} from 'react-router-dom';

import type {IMouse} from './lib/shared';
import type {ITextEntryJsonApi} from './lib/store/models/TextEntryModel';
import {StyledMenuItem} from './StyledMenuItem';

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
  const {user, tag} = useParams();
  const [searchParams] = useSearchParams();
  const entriesFilter = searchParams.get('entries');

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
          : {top: 0, left: 0}
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
      {user !== undefined && tag !== undefined && (
        <StyledMenuItem
          id={`tagsEntriesContextMenu${id}Untag`}
          onClick={() => {
            handleRemoveFromList();
          }}
        >
          Untag
        </StyledMenuItem>
      )}
      {entriesFilter === 'untagged' && (
        <StyledMenuItem
          id={`tagsEntriesContextMenu${id}Delete`}
          onClick={() => {
            handleRemoveFromList();
          }}
        >
          Delete
        </StyledMenuItem>
      )}
    </StyledMenu>
  );
};

const memoizedEntryContextMenu = React.memo(EntryContextMenu);
export {memoizedEntryContextMenu as EntryContextMenu};
