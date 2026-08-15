import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React from 'react';

import packageJson from '../../../../package.json';

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
}

const AboutDialog = ({dialogOpen, closeDialog}: IProps) => {
  return (
    <Dialog
      id="HelpMenuAboutDialog"
      fullWidth={true}
      maxWidth="sm"
      open={dialogOpen}
      onClose={closeDialog}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
    >
      <DialogTitle>About Tearleads</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{color: theme => theme.palette.text.primary}}>
          v{packageJson.version}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          id="HelpAboutDismissButton"
          color="secondary"
          variant="outlined"
          onClick={closeDialog}
          autoFocus
          sx={{
            color: theme => theme.palette.text.primary,
            borderColor: theme => theme.palette.text.secondary,
            '&:hover': {
              borderColor: theme => theme.palette.text.primary,
            },
          }}
        >
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const memoizedAboutDialog = React.memo(AboutDialog);

export {memoizedAboutDialog as AboutDialog};
