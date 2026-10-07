import type {Backup} from '@commandsnippets/api-shared/responses';
import React from 'react';
import {createPortal} from 'react-dom';
import {useTypedTranslation} from '../../../i18n/hooks';
import {ApiRequestError} from '../../../lib/api/apiClient';
import {
  liveCounts,
  readBackupFile,
  restoreBackup,
} from '../../../lib/data/backup';
import {useAppConfig} from '../../../lib/state/appState';
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
  const appConfig = useAppConfig();
  const input = React.useRef<HTMLInputElement>(null);
  const [state, setState] = React.useState<RestoreStep>({step: 'closed'});

  const handleClick = () => {
    onClose();
    input.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again.
    event.target.value = '';
    const username = appConfig.loggedInUser;
    if (file === undefined || username === null) {
      return;
    }
    try {
      const backup = readBackupFile(await file.text());
      setState({
        step: 'confirm',
        backup,
        current: await liveCounts(username),
      });
    } catch (error: unknown) {
      console.error('ERROR: not a backup:', error);
      setState({step: 'invalid'});
    }
  };

  const handleConfirm = (backup: Backup) => {
    const username = appConfig.loggedInUser;
    if (username === null) {
      setState({step: 'closed'});
      return;
    }
    setState({step: 'restoring'});
    restoreBackup(username, backup)
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
