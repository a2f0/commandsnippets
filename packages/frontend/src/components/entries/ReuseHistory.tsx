import type {
  TextEntry,
  TextEntryReused,
} from '@commandsnippets/api-shared/responses';
import {History, Refresh} from '@mui/icons-material';
import {Alert, Box, Button, Typography} from '@mui/material';
import {useLiveQuery} from 'dexie-react-hooks';
import {useEffect, useRef, useState} from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {formatTimestamp, timestampWithZone} from '../../lib/formatTimestamp';
import {Link} from '../../lib/router/Router';
import {entryPath, reusesPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';
import {heldVersion} from '../../lib/sync/dataVersion';
import {isLocalId} from '../../lib/sync/outbox';
import type {SyncSession} from '../../lib/sync/session';

interface Props {
  session: SyncSession;
  initialSync: {failed: boolean; retry: () => void};
  /** Omit for every reuse across the profile. */
  entryId?: string;
  count?: number;
}

interface HistoryPage {
  reuses: TextEntryReused[];
  entries: TextEntry[];
  page: number;
  total: number;
  more: boolean;
}

const HistoryContent = ({session, entryId, count}: Props) => {
  const {t, i18n} = useTypedTranslation('entries');
  const [history, setHistory] = useState<HistoryPage | null>(null);
  const reuses = history?.reuses ?? null;
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [failedPage, setFailedPage] = useState(1);
  const running = useRef(false);
  const refreshPending = useRef(false);
  const readPage = useRef<(page: number) => void>(() => {});
  const loadMoreTarget = useRef<HTMLDivElement>(null);
  const unsent = entryId !== undefined && isLocalId(entryId);
  const all = entryId === undefined;
  const nextPage = history?.more ? history.page + 1 : null;

  useEffect(() => {
    if (unsent || session.readOnly) return undefined;
    let current = true;
    const read = (page: number) => {
      if (running.current) {
        // A changed count waits for the in-flight read, then refreshes once.
        if (page === 1) refreshPending.current = true;
        return;
      }
      running.current = true;
      setLoading(true);
      setFailed(false);
      session.sync
        .entryReuses(entryId, page)
        .then(result => {
          if (!current || result === null) return;
          setHistory(previous => {
            const reuses = new Map(
              (page === 1 ? [] : (previous?.reuses ?? [])).map(reuse => [
                reuse.id,
                reuse,
              ])
            );
            for (const reuse of result.data) reuses.set(reuse.id, reuse);
            const entries = new Map(
              (page === 1 ? [] : (previous?.entries ?? [])).map(entry => [
                entry.id,
                entry,
              ])
            );
            for (const resource of result.included ?? []) {
              if (
                resource.type === 'TextEntry' &&
                !resource.attributes.is_deleted
              )
                entries.set(resource.id, resource);
            }
            return {
              reuses: [...reuses.values()],
              entries: [...entries.values()],
              page,
              total: result.meta.pagination.count,
              more: result.links.next !== null && result.data.length > 0,
            };
          });
        })
        .catch((error: unknown) => {
          console.warn('WARNING: the reuses could not be read:', error);
          if (current) {
            setFailed(true);
            setFailedPage(page);
          }
        })
        .finally(() => {
          running.current = false;
          if (current) setLoading(false);
          if (refreshPending.current) {
            refreshPending.current = false;
            readPage.current(1);
          }
        });
    };
    readPage.current = read;
    const refresh = () => read(1);
    refresh();
    window.addEventListener('online', refresh);
    return () => {
      current = false;
      readPage.current = () => {};
      window.removeEventListener('online', refresh);
    };
  }, [session, entryId, count, unsent]);

  useEffect(() => {
    const target = loadMoreTarget.current;
    if (
      target === null ||
      nextPage === null ||
      loading ||
      failed ||
      unsent ||
      session.readOnly ||
      typeof IntersectionObserver === 'undefined'
    )
      return undefined;

    // Re-observe after each page: a short batch can leave the footer in view.
    // Each observer may request only once, even before React commits loading.
    let active = true;
    const observer = new IntersectionObserver(
      entries => {
        if (!active || !entries.some(entry => entry.isIntersecting)) return;
        active = false;
        observer.disconnect();
        readPage.current(nextPage);
      },
      {rootMargin: '0px 0px 400px 0px'}
    );
    observer.observe(target);
    return () => {
      active = false;
      observer.disconnect();
    };
  }, [nextPage, loading, failed, unsent, session.readOnly]);

  const entryById = new Map(history?.entries.map(entry => [entry.id, entry]));
  const refresh = () => readPage.current(1);
  const errorNotice = failed && (
    <Alert
      severity="warning"
      sx={{m: 2}}
      action={
        <Button
          color="inherit"
          size="small"
          disabled={loading}
          onClick={() => readPage.current(failedPage)}
        >
          {t('reuseHistoryRetry')}
        </Button>
      }
    >
      {t('reuseHistoryFailed')}
    </Alert>
  );
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
            {all ? t('profileReuseHistory') : t('reuseHistory')}
          </Typography>
          {reuses !== null && (
            <Typography variant="body2" color="text.secondary">
              {t('reuseTotal', {count: history?.total ?? 0})}
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
      {failedPage === 1 && errorNotice}
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
            aria-busy={loading}
            sx={{listStyle: 'none', p: 0, m: 0}}
          >
            {reuses.map(reuse => {
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
                      dateTime={timestampWithZone(
                        reuse.attributes.date_created
                      )}
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
          <Box
            ref={loadMoreTarget}
            id="entryReusePagination"
            sx={{
              p: 2,
              borderTop: 1,
              borderColor: 'divider',
              textAlign: 'center',
            }}
          >
            {failedPage > 1 && errorNotice}
            {nextPage !== null && (
              <Button
                variant="outlined"
                loading={loading}
                disabled={failed}
                aria-controls="entryReuses"
                onClick={() => readPage.current(nextPage)}
              >
                {t('reuseShowMore')}
              </Button>
            )}
            <Typography
              role="status"
              variant="body2"
              color="text.secondary"
              sx={{mt: nextPage !== null ? 1 : 0}}
            >
              {loading
                ? t('reuseHistoryLoading')
                : nextPage === null && !failed
                  ? t('reuseHistoryEnd')
                  : null}
            </Typography>
          </Box>
        </>
      )}
    </Box>
  );
};

/** Drop the previous version's history when a restore or version switch occurs. */
export const ReuseHistory = (props: Props) => {
  const {t} = useTypedTranslation('entries');
  const version = useLiveQuery(
    () => heldVersion(props.session.db, props.session.owner),
    [props.session]
  );
  if (
    version === undefined &&
    !props.session.readOnly &&
    !(props.entryId && isLocalId(props.entryId))
  )
    return props.initialSync.failed ? (
      <Alert
        severity="warning"
        sx={{mt: 3}}
        action={
          <Button
            color="inherit"
            size="small"
            onClick={props.initialSync.retry}
          >
            {t('reuseHistoryRetry')}
          </Button>
        }
      >
        {t('reuseHistoryFailed')}
      </Alert>
    ) : (
      <Typography role="status" sx={{mt: 3}}>
        {t('reuseHistoryLoading')}
      </Typography>
    );
  return (
    <HistoryContent
      key={`${version ?? ''}:${props.entryId ?? ''}`}
      {...props}
    />
  );
};
