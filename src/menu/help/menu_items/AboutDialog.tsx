import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import React from 'react';

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
}

const AboutDialog = ({dialogOpen, closeDialog}: IProps) => {
  return (
    <Dialog
      id="HelpMenuAboutDialog"
      open={dialogOpen}
      onClose={closeDialog}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle>About Tearleads</DialogTitle>
      <DialogContent>
        <DialogContentText></DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          id="HelpAboutDismissButton"
          color="secondary"
          variant="outlined"
          onClick={closeDialog}
          autoFocus
        >
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default React.memo(AboutDialog);
