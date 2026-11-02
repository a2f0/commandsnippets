import {Button} from '@mui/material';
import {type AdminKeys, useTypedTranslation} from '../../i18n/hooks';
import type {AdminUser} from '../../lib/api/adminApi';
import {SimpleDialog} from '../SimpleDialog';
import type {AdminUserChange} from './AdminUserContextMenu';

const ACTION_DIALOGS: Record<
  AdminUserChange,
  {title: AdminKeys; body: AdminKeys}
> = {
  deactivate: {title: 'deactivateTitle', body: 'deactivateBody'},
  reactivate: {title: 'reactivateTitle', body: 'reactivateBody'},
  markForDeletion: {
    title: 'markForDeletionTitle',
    body: 'markForDeletionBody',
  },
  unmarkForDeletion: {
    title: 'unmarkForDeletionTitle',
    body: 'unmarkForDeletionBody',
  },
};

export interface PendingChange {
  user: AdminUser;
  action: AdminUserChange;
}

interface IProps {
  /** The change to confirm, or null: closed. */
  pending: PendingChange | null;
  /** The change is being made: nothing closes the dialog. */
  updating: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Asks staff to confirm a change to a user's account. */
export const AdminConfirmDialog = ({
  pending,
  updating,
  onCancel,
  onConfirm,
}: IProps) => {
  const {t} = useTypedTranslation('admin');
  const {t: tCommon} = useTypedTranslation('common');
  const dialog = pending === null ? null : ACTION_DIALOGS[pending.action];

  return (
    <SimpleDialog
      id="adminConfirm"
      open={pending !== null}
      onClose={() => {
        if (!updating) {
          onCancel();
        }
      }}
      title={
        pending !== null &&
        dialog !== null &&
        t(dialog.title, {username: pending.user.username})
      }
      text={dialog === null ? undefined : t(dialog.body)}
      actions={
        pending !== null && (
          <>
            <Button
              id="adminConfirmCancel"
              variant="outlined"
              disabled={updating}
              onClick={onCancel}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              id="adminConfirmButton"
              variant="outlined"
              disabled={updating}
              onClick={onConfirm}
            >
              {t(pending.action)}
            </Button>
          </>
        )
      }
    />
  );
};
