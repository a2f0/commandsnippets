import React, {useEffect, useState} from 'react';
import {createStyles, withStyles} from '@material-ui/core/styles';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {IMouse} from './Entry';
import Menu from '@material-ui/core/Menu';
import {MenuStyle} from './MenuBar';
import StyledMenuItem from './StyledMenuItem';
import {WithStyles} from '@material-ui/core';

interface ITagContextMenuProps {
  id: string;
  mouse: IMouse;
  deleteTag: () => void;
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
  children: React.PropsWithChildren<{}>;
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

const TagContextMenu = ({id, mouse, deleteTag}: ITagContextMenuProps) => {
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

  const handleDelete = () => {
    setMousePosition(initialMouse);
    setDialogOpen(true);
  };

  const handleCancelDialog = () => {
    setDialogOpen(false);
  };

  const handleAcceptDialog = () => {
    console.info('accept dialog');
    setDialogOpen(false);
    deleteTag();
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
        <StyledMenuItem onClick={handleClose}>New Tag</StyledMenuItem>
        <StyledMenuItem onClick={handleDelete}>Delete Tag</StyledMenuItem>
      </StyledMenu>
      <Dialog
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
          <Button onClick={handleCancelDialog}>Cancel</Button>
          <Button onClick={handleAcceptDialog} autoFocus>
            Delete
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
export default React.memo(TagContextMenu);
