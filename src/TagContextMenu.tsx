import React, {useEffect, useState} from 'react';
import Menu from '@material-ui/core/Menu';
import MenuItem from '@material-ui/core/MenuItem';
import Button from '@material-ui/core/Button';
import Dialog from '@material-ui/core/Dialog';
import DialogActions from '@material-ui/core/DialogActions';
import DialogContent from '@material-ui/core/DialogContent';
import DialogContentText from '@material-ui/core/DialogContentText';
import DialogTitle from '@material-ui/core/DialogTitle';
import {IMouse} from './Entry';

interface ITagContextMenuProps {
  mouse: IMouse;
  deleteTag: () => void;
}

const TagContextMenu = React.memo(function TagContextMenu(
  props: ITagContextMenuProps
) {
  const initialMouse: IMouse = {
    mouseX: null,
    mouseY: null,
  };

  const [mouse, setMouse] = useState<IMouse>(initialMouse);
  const [dialogOpen, setDialogOpen] = React.useState(false);

  useEffect(() => {
    setMouse(props.mouse);
  }, [props.mouse]);

  const handleClose = () => {
    setMouse(initialMouse);
  };

  const handleDelete = () => {
    setMouse(initialMouse);
    setDialogOpen(true);
  };

  const handleCancelDialog = () => {
    setDialogOpen(false);
  };

  const handleAcceptDialog = () => {
    console.info('accept dialog');
    setDialogOpen(false);
    props.deleteTag();
  };

  return (
    <>
      <Menu
        keepMounted
        open={mouse.mouseY !== null}
        onClose={handleClose}
        anchorReference="anchorPosition"
        anchorPosition={
          mouse.mouseY !== null && mouse.mouseX !== null
            ? {top: mouse.mouseY, left: mouse.mouseX}
            : undefined
        }
      >
        <MenuItem onClick={handleClose}>New Tag</MenuItem>
        <MenuItem onClick={handleDelete}>Delete Tag</MenuItem>
      </Menu>
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
});
export default TagContextMenu;
