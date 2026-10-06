import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {commonButtonSx} from '../../../theme/sx';

interface IProps {
  open: boolean;
  onClose: () => void;
}

/** What Export Backup shows when no backup could be saved. */
const ExportBackupFailedDialog = ({open, onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');

  return (
    <Dialog
      id="exportBackupFailed"
      open={open}
      onClose={onClose}
      aria-labelledby="exportBackupFailedTitle"
      aria-describedby="exportBackupFailedText"
    >
      <DialogTitle id="exportBackupFailedTitle">
        {t('exportBackupFailedTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="exportBackupFailedText">
          {t('exportBackupFailed')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          id="exportBackupFailedDismiss"
          variant="outlined"
          onClick={onClose}
          autoFocus
          sx={commonButtonSx}
        >
          {tCommon('dismiss')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

const memoizedExportBackupFailedDialog = React.memo(ExportBackupFailedDialog);

export {memoizedExportBackupFailedDialog as ExportBackupFailedDialog};
