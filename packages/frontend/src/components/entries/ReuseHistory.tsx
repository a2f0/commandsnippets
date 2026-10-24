import type {
  TextEntry,
  TextEntryReused,
} from '@commandsnippets/api-shared/responses';
import {History, Refresh} from '@mui/icons-material';
import {Alert, Box, Button, Typography} from '@mui/material';
import {useLiveQuery} from 'dexie-react-hooks';
import {useEffect, useState} from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {SYNC_INTERVAL_MS} from '../../lib/data/useSync';
import {formatTimestamp} from '../../lib/formatTimestamp';
import {Link} from '../../lib/router/Router';
import {entryPath, reusesPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';
import {heldVersion} from '../../lib/sync/dataVersion';
import {isLocalId} from '../../lib/sync/outbox';
import type {SyncSession} from '../../lib/sync/session';

interface Props {
  session: SyncSession;
  /** Omit for every reuse across the profile. */
  entryId?: string;
  count?: number;
  entries?: TextEntry[];
}

const PAGE_SIZE = 50;

const HistoryContent = ({session, entryId, count, entries}: Props) => {
  const {t, i18n} = useTypedTranslation('entries');
  const [reuses, setReuses] = useState<TextEntryReused[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const unsent = entryId !== undefined && isLocalId(entryId);
  const all = entryId === undefined;

  useEffect(() => {
    if (unsent || session.readOnly) return undefined;
    let current = true;
    let running = false;
    const read = () => {
      if (running) return;
      running = true;
      setLoading(true);
      setFailed(false);
      session.sync
        .entryReuses(entryId)
        .then(result => {
          if (current) setReuses(result);
        })
        .catch((error: unknown) => {
          console.warn('WARNING: the reuses could not be read:', error);
          if (current) setFailed(true);
        })
        .finally(() => {
          running = false;
          if (current) setLoading(false);
        });
    };
    const inView = () => {
      if (document.visibilityState === 'visible') read();
    };
    read();
    window.addEventListener('online', read);
    document.addEventListener('visibilitychange', inView);
    const timer = setInterval(inView, SYNC_INTERVAL_MS);
    return () => {
      current = false;
      window.removeEventListener('online', read);
      document.removeEventListener('visibilitychange', inView);
      clearInterval(timer);
    };
  }, [session, entryId, count, attempt, unsent]);

  const entryById = new Map(entries?.map(entry => [entry.id, entry]));
  const refresh = () => setAttempt(value => value + 1);
  return (
    <Box
      component="section"
      aria-labelledby="entryReuseHistory"
      sx={{border: 1, borderColor: 'divider', mt: 3}}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 1,
          px: {xs: 2, sm: 3},
          py: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography id="entryReuseHistory" variant="h6" component="h2">
            {all ? t('recentReuses') : t('reuseHistory')}
          </Typography>
          {reuses !== null && (
            <Typography variant="body2" color="text.secondary">
              {t('reuseTotal', {count: reuses.length})}
            </Typography>
          )}
        </Box>
        <Box sx={{display: 'flex', gap: 1}}>
          {!all && !session.readOnly && (
            <Button
              component={Link}
              to={reusesPath(session.owner)}
              size="small"
            >
              {t('allReuses')}
            </Button>
          )}
          {!session.readOnly && !unsent && (
            <Button
              size="small"
              startIcon={<Refresh />}
              disabled={loading}
              onClick={refresh}
            >
              {t('reuseRefresh')}
            </Button>
          )}
        </Box>
      </Box>
      {failed && (
        <Alert
          severity="warning"
          sx={{m: 2}}
          action={
            <Button color="inherit" size="small" onClick={refresh}>
              {t('reuseHistoryRetry')}
            </Button>
          }
        >
          {t('reuseHistoryFailed')}
        </Alert>
      )}
      {unsent || session.readOnly || reuses === null || reuses.length === 0 ? (
        <Box sx={{p: 3}}>
          <Typography
            color="text.secondary"
            role={
              loading && !unsent && !session.readOnly ? 'status' : undefined
            }
          >
            {unsent
              ? t('infoNotSent')
              : session.readOnly
                ? t('reuseHistoryOwnerOnly')
                : reuses === null
                  ? loading
                    ? t('reuseHistoryLoading')
                    : null
                  : all
                    ? t('allReusesEmpty')
                    : t('reuseHistoryEmpty')}
          </Typography>
        </Box>
      ) : (
        <>
          <Box
            component="ol"
            id="entryReuses"
            aria-label={t('reuseHistory')}
            sx={{listStyle: 'none', p: 0, m: 0}}
          >
            {reuses.slice(0, visible).map(reuse => {
              const id = reuse.relationships.text_entry.data.id;
              const entry = entryById.get(id);
              const path = entryPath(session.owner, id);
              return (
                <Box
                  component="li"
                  key={reuse.id}
                  sx={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 2,
                    px: {xs: 2, sm: 3},
                    py: 2,
                    '& + li': {borderTop: 1, borderColor: 'divider'},
                  }}
                >
                  <History
                    sx={{fontSize: 20, color: 'text.secondary', mt: 0.25}}
                  />
                  <Box sx={{minWidth: 0}}>
                    {all && (
                      <Typography
                        sx={{
                          fontWeight: 500,
                          mb: 0.5,
                          overflowWrap: 'anywhere',
                        }}
                      >
                        {entry ? (
                          <Link
                            to={path}
                            style={{
                              color: 'inherit',
                              textUnderlineOffset: '3px',
                            }}
                            onClick={() =>
                              useAppState
                                .getState()
                                .setEntryReturnPath(
                                  path,
                                  reusesPath(session.owner)
                                )
                            }
                          >
                            {entry.attributes.subject}
                          </Link>
                        ) : (
                          t('reuseUnavailableEntry', {id})
                        )}
                      </Typography>
                    )}
                    <Typography
                      component="time"
                      variant="body2"
                      dateTime={`${reuse.attributes.date_created}Z`}
                      color={all ? 'text.secondary' : 'text.primary'}
                    >
                      {formatTimestamp(
                        reuse.attributes.date_created,
                        i18n.language,
                        'medium'
                      )}
                    </Typography>
                  </Box>
                </Box>
              );
            })}
          </Box>
          {visible < reuses.length && (
            <Box
              sx={{
                p: 2,
                borderTop: 1,
                borderColor: 'divider',
                textAlign: 'center',
              }}
            >
              <Button
                variant="outlined"
                onClick={() => setVisible(value => value + PAGE_SIZE)}
              >
                {t('reuseShowMore')}
              </Button>
            </Box>
          )}
        </>
      )}
    </Box>
  );
};

/** Drop the previous version's history when a restore or version switch occurs. */
export const ReuseHistory = (props: Props) => {
  const version = useLiveQuery(
    () => heldVersion(props.session.db, props.session.owner),
    [props.session]
  );
  return (
    <HistoryContent
      key={`${version ?? ''}:${props.entryId ?? ''}`}
      {...props}
    />
  );
};
