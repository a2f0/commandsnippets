import React, {useCallback, useEffect, useState} from 'react';
import {IMouse} from './Entry';
import {Menu} from '@mui/material';
import StyledMenuItem from './StyledMenuItem';
import TagDeleteDialog from './TagDeleteDialog';

interface ITagContextMenuProps {
  id: string;
  mouse: IMouse;
  deleteTagParent: () => void;
  handleBeginEditParent: () => void;
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

const TagContextMenu = ({
  id,
  mouse,
  deleteTagParent,
  handleBeginEditParent,
}: ITagContextMenuProps) => {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mousePosition, setMousePosition] = useState<IMouse>(initialMouse);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  useEffect(() => {
    setMousePosition(mouse);
  }, [mouse]);

  const handleClose = useCallback(() => {
    setMousePosition(initialMouse);
  }, []);

  const handleBeginEdit = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    handleBeginEditParent();
    handleClose();
  }, []);

  const handleDelete = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setMousePosition(initialMouse);
    setDialogOpen(true);
  }, []);

  const handleCancelDialog = useCallback(() => {
    setDialogOpen(false);
  }, []);

  const handleAcceptDialog = useCallback(() => {
    setDialogOpen(false);
    deleteTagParent();
  }, []);

  return (
    <>
      <StyledMenu
        id={`tagContextMenu-${id}`}
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
          id={`tag-context-menu-${id}-new-tag`}
          onClick={handleClose}
        >
          New Tag
        </StyledMenuItem>
        <StyledMenuItem
          id={`tag-context-menu-${id}-edit-tag`}
          onClick={handleBeginEdit}
        >
          Edit Tag
        </StyledMenuItem>
        <StyledMenuItem
          id={`tagContextMenu${id}DeleteTagMenuItem`}
          onClick={handleDelete}
        >
          Delete Tag
        </StyledMenuItem>
      </StyledMenu>
      <TagDeleteDialog
        id={id}
        open={dialogOpen}
        handleClose={handleClose}
        handleAcceptDialog={handleAcceptDialog}
        handleCancelDialog={handleCancelDialog}
      />
    </>
  );
};
export default React.memo(TagContextMenu);
