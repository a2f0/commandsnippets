import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React from 'react';

interface ITagDeleteDialog {
  id: string;
  open: boolean;
  handleClose: () => void;
  handleCancelDialog: () => void;
  handleAcceptDialog: () => void;
}

const TagDeleteDialog = ({
  id,
  open,
  handleClose,
  handleCancelDialog,
  handleAcceptDialog,
}: ITagDeleteDialog) => {
  return (
    <Dialog
      id={`tagContextMenu${id}DeleteTagDialog`}
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {'Are you sure you want to delete this tag?'}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description" />
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
  );
};

const memoizedTagDeleteDialog = React.memo(TagDeleteDialog);
export {memoizedTagDeleteDialog as TagDeleteDialog};
