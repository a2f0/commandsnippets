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
          variant="outlined"
          onClick={handleCancelDialog}
          sx={{
            color: theme => theme.palette.text.primary,
            borderColor: theme => theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme => theme.palette.text.primary,
            },
          }}
        >
          Cancel
        </Button>
        <Button
          id={`tagContextMenu${id}DeleteTagDialogDeleteButton`}
          variant="outlined"
          onClick={handleAcceptDialog}
          autoFocus
          sx={{
            color: theme => theme.palette.text.primary,
            borderColor: theme => theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme => theme.palette.text.primary,
            },
          }}
        >
          Delete
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const memoizedTagDeleteDialog = React.memo(TagDeleteDialog);
export {memoizedTagDeleteDialog as TagDeleteDialog};
