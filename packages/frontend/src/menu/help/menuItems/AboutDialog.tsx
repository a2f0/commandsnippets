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
import {useTypedTranslation} from '../../../i18n/hooks';
import {useApiVersion} from '../../../lib/api/apiVersion';

interface IProps {
  dialogOpen: boolean;
  closeDialog: () => void;
}

const AboutDialog = ({dialogOpen, closeDialog}: IProps) => {
  const {t} = useTypedTranslation('menu');
  // The version the API's latest answer named: it follows a deploy.
  const apiVersion = useApiVersion(state => state.version);

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
      <DialogTitle>{t('aboutDialogTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText
          id="HelpAboutAppVersion"
          sx={{color: theme => theme.palette.text.primary}}
        >
          {t('appVersion', {version: `v${packageJson.version}`})}
        </DialogContentText>
        <DialogContentText
          id="HelpAboutApiVersion"
          sx={{color: theme => theme.palette.text.primary}}
        >
          {t('apiVersion', {
            version:
              apiVersion === null ? t('versionUnknown') : `v${apiVersion}`,
          })}
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
