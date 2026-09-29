import React from 'react';

import {useAppContext} from '../../../AppContext';
import {useTypedTranslation} from '../../../i18n/hooks';
import {syncSession} from '../../../lib/sync/session';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

/**
 * Sync the signed-in user's IndexedDB database (`lib/sync/`), which the app
 * does not read yet, and log what it holds.
 */
const SyncIndexedDB = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const appConfig = useAppContext();

  const sync = async (username: string) => {
    const {db, sync} = syncSession(username);
    await sync.syncAll();
    const [tags, entries, junctions] = await Promise.all([
      db.tags.count(),
      db.entries.count(),
      db.junctions.count(),
    ]);
    console.info(
      `OK: IndexedDB synced: ${tags} tags, ${entries} entries, ${junctions} junctions`
    );
  };

  return (
    <StyledMenuItem
      id="debug-menu-sync-indexed-db"
      key="Sync IndexedDB"
      onClick={() => {
        const username = appConfig.loggedInUser;
        if (username !== null) {
          sync(username).catch((error: unknown) => {
            console.error('ERROR: IndexedDB sync failed:', error);
          });
        }
        onClose();
      }}
    >
      {t('syncIndexedDB')}
    </StyledMenuItem>
  );
};

const memoizedSyncIndexedDB = React.memo(SyncIndexedDB);

export {memoizedSyncIndexedDB as SyncIndexedDB};
