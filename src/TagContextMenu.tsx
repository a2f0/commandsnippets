import React, {useEffect, useState} from 'react';
import {Button} from '@mui/material';
import {Dialog} from '@mui/material';
import {DialogActions} from '@mui/material';
import {DialogContent} from '@mui/material';
import {DialogContentText} from '@mui/material';
import {DialogTitle} from '@mui/material';
import {IMouse} from './Entry';
import {Menu} from '@mui/material';
import StyledMenuItem from './StyledMenuItem';

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

  const handleClose = () => {
    setMousePosition(initialMouse);
  };

  const handleBeginEdit = () => {
    handleBeginEditParent();
    handleClose();
  };

  const handleDelete = () => {
    setMousePosition(initialMouse);
    setDialogOpen(true);
  };

  const handleCancelDialog = () => {
    setDialogOpen(false);
  };

  const handleAcceptDialog = () => {
    setDialogOpen(false);
    deleteTagParent();
  };

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
      <Dialog
        id={`tagContextMenu${id}DeleteTagDialog`}
        open={dialogOpen}
        onClose={handleClose}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
          {'Are you sure you want to delete this tag?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="alert-dialog-description"></DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            id={`tagContextMenu${id}DeleteTagDialogCancelButton`}
            color="secondary"
            variant="outlined"
            onClick={handleCancelDialog}
          >
            Cancel
          </Button>
          <Button
            id={`tagContextMenu${id}DeleteTagDialogDeleteButton`}
            color="secondary"
            variant="outlined"
            onClick={handleAcceptDialog}
            autoFocus
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
export default React.memo(TagContextMenu);
