import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {exportBackup} from '../../../lib/data/backup';
import {useAppConfig} from '../../../lib/state/appState';
import {StyledMenuItem} from '../../StyledMenuItem';
import {ExportBackupFailedDialog} from './ExportBackupFailedDialog';

interface IProps {
  onClose: () => void;
}

/**
 * Save a backup of the signed-in user's data (`lib/data/backup.ts`), or say
 * that none could be made.
 */
const ExportBackup = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const appConfig = useAppConfig();
  const [failed, setFailed] = React.useState(false);
  // One export at a time: another click meanwhile changes nothing.
  const exporting = React.useRef(false);

  const handleClick = () => {
    onClose();
    const username = appConfig.loggedInUser;
    if (username === null || exporting.current) {
      return;
    }
    exporting.current = true;
    exportBackup(username)
      .catch((error: unknown) => {
        console.error('ERROR: backup export failed:', error);
        setFailed(true);
      })
      .finally(() => {
        exporting.current = false;
      });
  };

  return (
    <>
      <StyledMenuItem id="file-menu-export-backup" onClick={handleClick}>
        {t('exportBackup')}
      </StyledMenuItem>
      <ExportBackupFailedDialog
        open={failed}
        onClose={() => setFailed(false)}
      />
    </>
  );
};

const memoizedExportBackup = React.memo(ExportBackup);

export {memoizedExportBackup as ExportBackup};
