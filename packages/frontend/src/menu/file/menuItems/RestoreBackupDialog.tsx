import type {Backup} from '@commandsnippets/api-shared/responses';
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
import type {RestoreStep} from './restoreBackupFlow';

interface IProps {
  state: RestoreStep;
  onConfirm: () => void;
  onClose: () => void;
}

const counts = {
  fontFamily: 'monospace',
  color: 'text.primary',
} as const;

/** The warning: the data the backup replaces, and the backup's. */
const ConfirmText = ({
  backup,
  current,
}: {
  backup: Backup;
  current: {tags: number; entries: number};
}) => {
  const {t, i18n} = useTypedTranslation('menu');
  return (
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
  );
};

type ShownStep = Exclude<RestoreStep, {step: 'closed' | 'reading'}>;

/** The dialog's title, text and buttons at `view`'s step. */
function useStepContent(
  view: ShownStep,
  onConfirm: IProps['onConfirm'],
  onClose: () => void
): {title: string; body: React.ReactNode; actions: React.ReactNode} {
  const {t} = useTypedTranslation('menu');
  const {t: tCommon} = useTypedTranslation('common');
  const dismiss = (
    <Button
      id="restoreBackupDismiss"
      variant="outlined"
      onClick={onClose}
      autoFocus
    >
      {tCommon('dismiss')}
    </Button>
  );

  switch (view.step) {
    case 'confirm': {
      const {backup, current} = view;
      return {
        title: t('restoreConfirmTitle'),
        body: <ConfirmText backup={backup} current={current} />,
        actions: (
          <>
            <Button
              id="restoreBackupCancel"
              variant="outlined"
              onClick={onClose}
              autoFocus
            >
              {tCommon('cancel')}
            </Button>
            <Button
              id="restoreBackupConfirm"
              variant="outlined"
              onClick={onConfirm}
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
              {t('restoreDoneText', {version: view.result.data_version})}
            </DialogContentText>
            <DialogContentText sx={{...counts, mt: 2}}>
              {t('restoreCounts', view.result)}
            </DialogContentText>
            {!view.shown && (
              <DialogContentText id="restoreBackupReload" sx={{mt: 2}}>
                {t('restoreDoneNotShown')}
              </DialogContentText>
            )}
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
}

/** The restore's warning, then its progress and outcome. */
const RestoreBackupDialog = ({state, onConfirm, onClose}: IProps) => {
  // While it closes, it shows what it last did.
  const shown = React.useRef<ShownStep>({step: 'invalid'});
  const open = state.step !== 'closed' && state.step !== 'reading';
  if (open) {
    shown.current = state;
  }
  // Nothing closes it while the restore runs.
  const close = state.step === 'restoring' ? undefined : onClose;
  const {title, body, actions} = useStepContent(
    shown.current,
    onConfirm,
    onClose
  );
  return (
    <Dialog
      id="restoreBackupDialog"
      open={open}
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
