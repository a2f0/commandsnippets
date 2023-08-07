import {Button} from '@mui/material';
import {Dialog} from '@mui/material';
import {DialogActions} from '@mui/material';
import {DialogContent} from '@mui/material';
import {DialogContentText} from '@mui/material';
import {DialogTitle} from '@mui/material';
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
        <DialogContentText color="secondary">
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
        >
          Dismiss
        </Button>
      </DialogActions>
    </Dialog>
  );
};
export default React.memo(AboutDialog);
