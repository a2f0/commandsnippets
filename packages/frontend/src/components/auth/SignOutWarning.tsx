import {Button} from '@mui/material';
import {useTypedTranslation} from '../../i18n/hooks';
import {
  cancelSignOut,
  confirmSignOut,
  useSignOutWarning,
} from '../../lib/state/signOutWarning';
import {SimpleDialog} from '../SimpleDialog';

/**
 * The warning a sign-out with writes not sent yet shows
 * (`requestSignOut`): stay, sign out keeping them on this device, or
 * discard them.
 */
export const SignOutWarning = () => {
  const {t} = useTypedTranslation('common');
  const unsent = useSignOutWarning(state => state.unsent);
  return (
    <SimpleDialog
      id="signOutWarning"
      open={unsent !== null}
      onClose={cancelSignOut}
      title={t('unsentWritesTitle')}
      text={`${t('unsentWrites', {count: unsent ?? 0})} ${t('unsentWritesKept')}`}
      actions={
        <>
          <Button
            id="signOutWarningCancel"
            variant="outlined"
            onClick={cancelSignOut}
            autoFocus
          >
            {t('cancel')}
          </Button>
          <Button
            id="signOutWarningDiscard"
            variant="outlined"
            onClick={() => void confirmSignOut({discardQueued: true})}
          >
            {t('discardAndSignOut')}
          </Button>
          <Button
            id="signOutWarningSignOut"
            variant="outlined"
            onClick={() => void confirmSignOut({discardQueued: false})}
          >
            {t('signOutKeepingWrites')}
          </Button>
        </>
      }
    />
  );
};
