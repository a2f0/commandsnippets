import {Button} from '@mui/material';
import React from 'react';
import {SimpleDialog} from '../../../components/SimpleDialog';
import {useTypedTranslation} from '../../../i18n/hooks';

interface IProps {
  open: boolean;
  onClose: () => void;
}

/** What Export Backup shows when no backup could be saved. */
const ExportBackupFailedDialog = ({open, onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');

  return (
    <SimpleDialog
      id="exportBackupFailed"
      open={open}
      onClose={onClose}
      title={t('exportBackupFailedTitle')}
      text={t('exportBackupFailed')}
      actions={
        <Button
          id="exportBackupFailedDismiss"
          variant="outlined"
          onClick={onClose}
          autoFocus
        >
          {tCommon('dismiss')}
        </Button>
      }
    />
  );
};

const memoizedExportBackupFailedDialog = React.memo(ExportBackupFailedDialog);

export {memoizedExportBackupFailedDialog as ExportBackupFailedDialog};
