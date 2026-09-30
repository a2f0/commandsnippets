import React from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useAppConfig} from '../../../lib/state/appState';
import {syncSession} from '../../../lib/sync/session';
import {StyledMenuItem} from '../../StyledMenuItem';

interface IProps {
  onClose: () => void;
}

/**
 * Sync the signed-in user's IndexedDB database now (`lib/sync/`; the entries
 * page syncs it on its own too), and log what it holds.
 */
const SyncIndexedDB = ({onClose}: IProps) => {
  const {t} = useTypedTranslation('menu');
  const appConfig = useAppConfig();

  const sync = async (username: string) => {
    const {db, sync} = syncSession(username);
    await sync.syncAll();
    const [tags, entries, junctions] = await Promise.all([
      db.tags.where('owner').equals(username).count(),
      db.entries.where('owner').equals(username).count(),
      db.junctions.where('owner').equals(username).count(),
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
