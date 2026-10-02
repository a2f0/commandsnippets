import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  cancelSignOut,
  confirmSignOut,
  useSignOutWarning,
} from '../../lib/state/signOutWarning';
import {commonButtonSx} from '../../theme/sx';

/**
 * The warning a sign-out with writes not sent yet shows
 * (`requestSignOut`): stay, sign out keeping them on this device, or
 * discard them.
 */
export const SignOutWarning = () => {
  const {t} = useTypedTranslation('common');
  const unsent = useSignOutWarning(state => state.unsent);
  return (
    <Dialog
      id="signOutWarning"
      open={unsent !== null}
      onClose={cancelSignOut}
      aria-labelledby="signOutWarningTitle"
      aria-describedby="signOutWarningText"
    >
      <DialogTitle id="signOutWarningTitle">
        {t('unsentWritesTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="signOutWarningText">
          {t('unsentWrites', {count: unsent ?? 0})} {t('unsentWritesKept')}
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button
          id="signOutWarningCancel"
          variant="outlined"
          onClick={cancelSignOut}
          autoFocus
          sx={commonButtonSx}
        >
          {t('cancel')}
        </Button>
        <Button
          id="signOutWarningDiscard"
          variant="outlined"
          color="error"
          onClick={() => void confirmSignOut({discardQueued: true})}
          sx={commonButtonSx}
        >
          {t('discardAndSignOut')}
        </Button>
        <Button
          id="signOutWarningSignOut"
          variant="outlined"
          onClick={() => void confirmSignOut({discardQueued: false})}
          sx={commonButtonSx}
        >
          {t('signOutKeepingWrites')}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
