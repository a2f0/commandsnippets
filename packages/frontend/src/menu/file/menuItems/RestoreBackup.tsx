import type {Backup} from '@commandsnippets/api-shared/responses';
import React from 'react';
import {createPortal} from 'react-dom';
import {useTypedTranslation} from '../../../i18n/hooks';
import {ApiRequestError} from '../../../lib/api/apiClient';
import {
  liveCounts,
  readBackupFile,
  restoreAccount,
  restoreBackup,
} from '../../../lib/data/backup';
import {useAppState} from '../../../lib/state/appState';
import {StyledMenuItem} from '../../StyledMenuItem';
import {RestoreBackupDialog, type RestoreStep} from './RestoreBackupDialog';

interface IProps {
  onClose: () => void;
}

/**
 * Replace all of the signed-in user's data with a backup file's
 * (`lib/data/backup.ts`): the file is read and checked, then the user is
 * warned what is deleted and what replaces it, and only their confirmation
 * restores it.
 */
const RestoreBackup = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const input = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<RestoreStep>({step: 'closed'});

  const handleClick = () => {
    onClose();
    input.current?.click();
  };

  const loggedInUser = useAppState(appState => appState.loggedInUser);
  // The warning is for the user who chose the file: another signed in
  // meanwhile (in another tab) closes it.
  React.useEffect(() => {
    setState(current =>
      current.step === 'confirm' && current.username !== loggedInUser
        ? {step: 'closed'}
        : current
    );
  }, [loggedInUser]);

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again.
    event.target.value = '';
    const username = useAppState.getState().loggedInUser;
    if (file === undefined || username === null) {
      return;
    }
    let backup: Backup;
    try {
      backup = readBackupFile(await file.text());
    } catch (error: unknown) {
      console.error('ERROR: not a backup:', error);
      setState({step: 'invalid'});
      return;
    }
    try {
      // The account the warning is about, and only it is restored.
      const accountId = await restoreAccount(username);
      const current = await liveCounts(username);
      setState(
        useAppState.getState().loggedInUser === username
          ? {step: 'confirm', username, accountId, backup, current}
          : {step: 'closed'}
      );
    } catch (error: unknown) {
      console.error('ERROR: backup restore failed:', error);
      setState({step: 'failed', detail: undefined});
    }
  };

  const handleConfirm = (
    username: string,
    accountId: string,
    backup: Backup
  ) => {
    // Only into the account the user was warned about.
    if (useAppState.getState().loggedInUser !== username) {
      setState({step: 'closed'});
      return;
    }
    setState({step: 'restoring'});
    restoreBackup(username, accountId, backup)
      .then(result => setState({step: 'done', result}))
      .catch((error: unknown) => {
        console.error('ERROR: backup restore failed:', error);
        setState({
          step: 'failed',
          detail: error instanceof ApiRequestError ? error.detail : undefined,
        });
      });
  };

  return (
    <>
      <StyledMenuItem id="file-menu-restore-backup" onClick={handleClick}>
        {t('restoreBackup')}
      </StyledMenuItem>
      {createPortal(
        <input
          ref={input}
          id="restoreBackupFile"
          type="file"
          accept="application/json,.json"
          hidden
          onChange={event => void handleFile(event)}
        />,
        document.body
      )}
      <RestoreBackupDialog
        state={state}
        onConfirm={handleConfirm}
        onClose={() => setState({step: 'closed'})}
      />
    </>
  );
};

const memoizedRestoreBackup = React.memo(RestoreBackup);

export {memoizedRestoreBackup as RestoreBackup};
