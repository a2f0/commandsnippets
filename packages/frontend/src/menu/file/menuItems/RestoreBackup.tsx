import type {Backup} from '@commandsnippets/api-shared/responses';
import React from 'react';
import {createPortal} from 'react-dom';
import {useTypedTranslation} from '../../../i18n/hooks';
import {ApiRequestError} from '../../../lib/api/errors';
import {
  liveCounts,
  RestoreNotAdoptedError,
  readBackupFile,
  restoreBackup,
  restoreTarget,
} from '../../../lib/data/backup';
import {useAppState} from '../../../lib/state/appState';
import {StyledMenuItem} from '../../StyledMenuItem';
import {RestoreBackupDialog} from './RestoreBackupDialog';
import {
  type RestoreEvent,
  type RestoreStep,
  transitionRestoreBackup,
} from './restoreBackupFlow';

interface IProps {
  onClose: () => void;
}

/** Check the file first, then the account/version and counts it replaces. */
async function readForConfirmation(
  state: Extract<RestoreStep, {step: 'reading'}>,
  send: React.Dispatch<RestoreEvent>,
  current: () => boolean
) {
  const {file, username, request} = state;
  let backup: Backup;
  try {
    const text = await file.text();
    if (!current()) return;
    backup = readBackupFile(text);
  } catch (error: unknown) {
    if (!current()) return;
    console.error('ERROR: not a backup:', error);
    send({type: 'invalid', username, request});
    return;
  }
  try {
    const target = await restoreTarget(username);
    if (!current()) return;
    const counts = await liveCounts(username);
    if (current())
      send({type: 'ready', username, request, target, backup, current: counts});
  } catch (error: unknown) {
    if (!current()) return;
    console.error('ERROR: backup restore failed:', error);
    send({type: 'readFailed', username, request});
  }
}

async function performRestore(
  state: Extract<RestoreStep, {step: 'restoring'}>,
  send: React.Dispatch<RestoreEvent>,
  current: () => boolean
) {
  const {username, request, target, backup} = state;
  try {
    const result = await restoreBackup(username, target, backup);
    if (current())
      send({type: 'restored', username, request, result, shown: true});
  } catch (error: unknown) {
    if (!current()) return;
    if (error instanceof RestoreNotAdoptedError) {
      // Restored: only this page is behind. Never offer it again.
      console.error('ERROR: restored, but not taken up here:', error);
      send({
        type: 'restored',
        username,
        request,
        result: error.result,
        shown: false,
      });
      return;
    }
    console.error('ERROR: backup restore failed:', error);
    send({
      type: 'restoreFailed',
      username,
      request,
      detail: error instanceof ApiRequestError ? error.detail : undefined,
    });
  }
}

function useRestoreBackup() {
  const [state, send] = React.useReducer(transitionRestoreBackup, {
    step: 'closed',
  });
  const nextRequest = React.useRef(0);
  const loggedInUser = useAppState(appState => appState.loggedInUser);
  React.useEffect(() => {
    send({type: 'select', username: loggedInUser});
  }, [loggedInUser]);
  React.useEffect(() => {
    let active = true;
    if (state.step === 'reading') {
      const current = () =>
        active && useAppState.getState().loggedInUser === state.username;
      void readForConfirmation(state, send, current);
    } else if (state.step === 'restoring') {
      void performRestore(state, send, () => active);
    }
    return () => {
      active = false;
    };
  }, [state]);

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // The same file can be chosen again.
    event.target.value = '';
    const username = useAppState.getState().loggedInUser;
    if (file === undefined || username === null) {
      send({type: 'close'});
      return;
    }
    nextRequest.current += 1;
    send({type: 'read', file, username, request: nextRequest.current});
  };
  const handleConfirm = () => {
    if (state.step !== 'confirm') return;
    // Only into the account the user was warned about.
    if (useAppState.getState().loggedInUser !== state.username) {
      send({type: 'close'});
      return;
    }
    send({type: 'confirm', username: state.username, request: state.request});
  };
  return {state, handleFile, handleConfirm, close: () => send({type: 'close'})};
}

/** File selection, warning, then a confirmed restore of that file only. */
const RestoreBackup = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const input = React.useRef<HTMLInputElement>(null);
  const {state, handleFile, handleConfirm, close} = useRestoreBackup();
  const handleClick = () => {
    // Opening another picker abandons the pending read, even if cancelled.
    close();
    onClose();
    input.current?.click();
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
          onChange={handleFile}
        />,
        document.body
      )}
      <RestoreBackupDialog
        state={state}
        onConfirm={handleConfirm}
        onClose={close}
      />
    </>
  );
};

const memoizedRestoreBackup = React.memo(RestoreBackup);

export {memoizedRestoreBackup as RestoreBackup};
