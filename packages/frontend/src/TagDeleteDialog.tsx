import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from './i18n/hooks';
import {commonButtonSx} from './styles/buttons';

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
  const {t: tTags} = useTypedTranslation('tags');
  const {t: tCommon} = useTypedTranslation('common');
  const buttonSx = commonButtonSx;

  return (
    <Dialog
      id={`tagContextMenu${id}DeleteTagDialog`}
      open={open}
      onClose={handleClose}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle id="alert-dialog-title">
        {tTags('confirmDeleteTag')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="alert-dialog-description" />
      </DialogContent>
      <DialogActions>
        <Button
          id={`tagContextMenu${id}DeleteTagDialogCancelButton`}
          variant="outlined"
          onClick={handleCancelDialog}
          sx={buttonSx}
        >
          {tCommon('cancel')}
        </Button>
        <Button
          id={`tagContextMenu${id}DeleteTagDialogDeleteButton`}
          variant="outlined"
          onClick={handleAcceptDialog}
          autoFocus
          sx={buttonSx}
        >
          {tCommon('delete')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const memoizedTagDeleteDialog = React.memo(TagDeleteDialog);

export {memoizedTagDeleteDialog as TagDeleteDialog};
