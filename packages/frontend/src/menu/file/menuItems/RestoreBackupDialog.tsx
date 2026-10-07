import type {
  Backup,
  RestoreResult,
} from '@commandsnippets/api-shared/responses';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  LinearProgress,
} from '@mui/material';
import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {formatTimestamp} from '../../../lib/formatTimestamp';
import {commonButtonSx} from '../../../theme/sx';

/** Where a restore is: what the dialog shows. */
export type RestoreStep =
  | {step: 'closed'}
  /** The file chosen is not a backup. */
  | {step: 'invalid'}
  /** The warning: the user's data now, and the backup's, to replace it. */
  | {
      step: 'confirm';
      backup: Backup;
      current: {tags: number; entries: number};
    }
  | {step: 'restoring'}
  | {step: 'done'; result: RestoreResult}
  /** `detail`: why the API refused the backup, when it said. */
  | {step: 'failed'; detail: string | undefined};

interface IProps {
  state: RestoreStep;
  onConfirm: (backup: Backup) => void;
  onClose: () => void;
}

const counts = {
  fontFamily: 'monospace',
  color: 'text.primary',
} as const;

/** The restore's warning, then its progress and outcome. */
const RestoreBackupDialog = ({state, onConfirm, onClose}: IProps) => {
  const {t, i18n} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');
  // While it closes, it shows what it last did.
  const shown = React.useRef<Exclude<RestoreStep, {step: 'closed'}>>({
    step: 'invalid',
  });
  if (state.step !== 'closed') {
    shown.current = state;
  }
  const view = shown.current;
  // Nothing closes it while the restore runs.
  const close = state.step === 'restoring' ? undefined : onClose;

  const dismiss = (
    <Button
      id="restoreBackupDismiss"
      variant="outlined"
      onClick={onClose}
      autoFocus
      sx={commonButtonSx}
    >
      {tCommon('dismiss')}
    </Button>
  );

  const content = (): {
    title: string;
    body: React.ReactNode;
    actions: React.ReactNode;
  } => {
    switch (view.step) {
      case 'confirm': {
        const {backup, current} = view;
        return {
          title: t('restoreConfirmTitle'),
          body: (
            <>
              <DialogContentText id="restoreBackupText">
                {t('restoreConfirmText')}
              </DialogContentText>
              <Box sx={{mt: 2}}>
                <DialogContentText>{t('restoreYourData')}</DialogContentText>
                <DialogContentText id="restoreBackupCurrent" sx={counts}>
                  {t('restoreCounts', current)}
                </DialogContentText>
              </Box>
              <Box sx={{mt: 2}}>
                <DialogContentText>
                  {t('restoreBackupData', {
                    username: backup.user.username,
                    date: formatTimestamp(backup.date_exported, i18n.language),
                  })}
                </DialogContentText>
                <DialogContentText id="restoreBackupIncoming" sx={counts}>
                  {t('restoreCounts', {
                    tags: backup.tags.length,
                    entries: backup.entries.length,
                  })}
                </DialogContentText>
              </Box>
            </>
          ),
          actions: (
            <>
              <Button
                id="restoreBackupCancel"
                variant="outlined"
                onClick={onClose}
                autoFocus
                sx={commonButtonSx}
              >
                {tCommon('cancel')}
              </Button>
              <Button
                id="restoreBackupConfirm"
                variant="outlined"
                color="error"
                onClick={() => onConfirm(backup)}
                sx={commonButtonSx}
              >
                {t('restoreConfirm')}
              </Button>
            </>
          ),
        };
      }
      case 'restoring':
        return {
          title: t('restoringTitle'),
          body: (
            <>
              <DialogContentText id="restoreBackupText">
                {t('restoringText')}
              </DialogContentText>
              <LinearProgress sx={{mt: 2}} />
            </>
          ),
          actions: null,
        };
      case 'done':
        return {
          title: t('restoreDoneTitle'),
          body: (
            <>
              <DialogContentText id="restoreBackupText">
                {t('restoreDoneText')}
              </DialogContentText>
              <DialogContentText sx={{...counts, mt: 2}}>
                {t('restoreCounts', view.result)}
              </DialogContentText>
            </>
          ),
          actions: dismiss,
        };
      case 'failed':
        return {
          title: t('restoreFailedTitle'),
          body: (
            <>
              <DialogContentText id="restoreBackupText">
                {t('restoreFailedText')}
              </DialogContentText>
              {view.detail !== undefined && (
                <DialogContentText id="restoreBackupDetail" sx={{mt: 2}}>
                  {view.detail}
                </DialogContentText>
              )}
            </>
          ),
          actions: dismiss,
        };
      default:
        return {
          title: t('restoreInvalidTitle'),
          body: (
            <DialogContentText id="restoreBackupText">
              {t('restoreInvalidText')}
            </DialogContentText>
          ),
          actions: dismiss,
        };
    }
  };

  const {title, body, actions} = content();
  return (
    <Dialog
      id="restoreBackupDialog"
      open={state.step !== 'closed'}
      onClose={close}
      fullWidth
      maxWidth="sm"
      aria-labelledby="restoreBackupTitle"
      aria-describedby="restoreBackupText"
    >
      <DialogTitle id="restoreBackupTitle">{title}</DialogTitle>
      <DialogContent>{body}</DialogContent>
      {actions !== null && <DialogActions>{actions}</DialogActions>}
    </Dialog>
  );
};

const memoizedRestoreBackupDialog = React.memo(RestoreBackupDialog);

export {memoizedRestoreBackupDialog as RestoreBackupDialog};
