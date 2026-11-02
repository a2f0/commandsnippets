import Refresh from '@mui/icons-material/Refresh';
import {Alert, Box, Button, Typography} from '@mui/material';
import {useLiveQuery} from 'dexie-react-hooks';
import type React from 'react';
import {useTypedTranslation} from '../../i18n/hooks';
import {Link} from '../../lib/router/Router';
import {reusesPath} from '../../lib/router/route';
import {heldVersion} from '../../lib/sync/dataVersion';
import {isLocalId} from '../../lib/sync/outbox';
import type {SyncSession} from '../../lib/sync/session';
import {ReuseHistoryList} from './ReuseHistoryList';
import {useReuseHistory} from './useReuseHistory';

interface Props {
  session: SyncSession;
  initialSync: {failed: boolean; retry: () => void};
  /** Omit for every reuse across the profile. */
  entryId?: string;
  count?: number;
}

/** What shows in place of the reuses when there are none to list, if anything. */
function emptyMessage(state: {
  unsent: boolean;
  readOnly: boolean;
  read: boolean;
  loading: boolean;
  all: boolean;
}) {
  if (state.unsent) return 'infoNotSent';
  if (state.readOnly) return 'reuseHistoryOwnerOnly';
  if (!state.read) return state.loading ? 'reuseHistoryLoading' : null;
  return state.all ? 'allReusesEmpty' : 'reuseHistoryEmpty';
}

/** A failed read, with Retry. */
const ReadFailed = ({
  onRetry,
  disabled = false,
  sx,
}: {
  onRetry: () => void;
  disabled?: boolean;
  sx: {m: number} | {mt: number};
}) => {
  const {t} = useTypedTranslation('entries');
  return (
    <Alert
      severity="warning"
      sx={sx}
      action={
        <Button
          color="inherit"
          size="small"
          disabled={disabled}
          onClick={onRetry}
        >
          {t('reuseHistoryRetry')}
        </Button>
      }
    >
      {t('reuseHistoryFailed')}
    </Alert>
  );
};

const HistoryHeader = ({
  session,
  all,
  total,
  canRefresh,
  loading,
  onRefresh,
}: {
  session: SyncSession;
  all: boolean;
  /** How many reuses there are, once read. */
  total: number | null;
  canRefresh: boolean;
  loading: boolean;
  onRefresh: () => void;
}) => {
  const {t} = useTypedTranslation('entries');
  return (
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
        {total !== null && (
          <Typography variant="body2" color="text.secondary">
            {t('reuseTotal', {count: total})}
          </Typography>
        )}
      </Box>
      <Box sx={{display: 'flex', gap: 1}}>
        {!all && !session.readOnly && (
          <Button component={Link} to={reusesPath(session.owner)} size="small">
            {t('allReuses')}
          </Button>
        )}
        {canRefresh && (
          <Button
            size="small"
            startIcon={<Refresh />}
            disabled={loading}
            onClick={onRefresh}
          >
            {t('reuseRefresh')}
          </Button>
        )}
      </Box>
    </Box>
  );
};

/**
 * Below the list: the next page's Show more (as the list's end comes into
 * view, it is read anyway), what is being read, or the end.
 */
const HistoryPagination = ({
  loadMoreTarget,
  errorNotice,
  nextPage,
  loading,
  failed,
  onMore,
}: {
  loadMoreTarget: (element: Element | null) => void;
  errorNotice: React.ReactNode;
  nextPage: number | null;
  loading: boolean;
  failed: boolean;
  onMore: (page: number) => void;
}) => {
  const {t} = useTypedTranslation('entries');
  return (
    <Box
      ref={loadMoreTarget}
      id="entryReusePagination"
      sx={{p: 2, borderTop: 1, borderColor: 'divider', textAlign: 'center'}}
    >
      {errorNotice}
      {nextPage !== null && (
        <Button
          variant="outlined"
          loading={loading}
          disabled={failed}
          aria-controls="entryReuses"
          onClick={() => onMore(nextPage)}
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
  );
};

const HistoryContent = ({session, entryId, count}: Props) => {
  const {t} = useTypedTranslation('entries');
  const {
    history,
    failed,
    loading,
    failedPage,
    readPage,
    unsent,
    nextPage,
    loadMoreTarget,
  } = useReuseHistory(session, entryId, count);
  const reuses = history?.reuses ?? null;
  const all = entryId === undefined;
  const errorNotice = failed && (
    <ReadFailed
      sx={{m: 2}}
      disabled={loading}
      onRetry={() => readPage.current(failedPage)}
    />
  );
  const empty =
    unsent || session.readOnly || reuses === null || reuses.length === 0;
  const emptyKey = emptyMessage({
    unsent,
    readOnly: session.readOnly,
    read: reuses !== null,
    loading,
    all,
  });
  return (
    <Box
      component="section"
      aria-labelledby="entryReuseHistory"
      sx={{border: 1, borderColor: 'divider', mt: 3}}
    >
      <HistoryHeader
        session={session}
        all={all}
        total={reuses === null ? null : (history?.total ?? 0)}
        canRefresh={!session.readOnly && !unsent}
        loading={loading}
        onRefresh={() => readPage.current(1)}
      />
      {failedPage === 1 && errorNotice}
      {empty ? (
        <Box sx={{p: 3}}>
          <Typography
            color="text.secondary"
            role={
              loading && !unsent && !session.readOnly ? 'status' : undefined
            }
          >
            {emptyKey === null ? null : t(emptyKey)}
          </Typography>
        </Box>
      ) : (
        <>
          <ReuseHistoryList
            reuses={reuses}
            entries={history?.entries ?? []}
            owner={session.owner}
            all={all}
            loading={loading}
          />
          <HistoryPagination
            loadMoreTarget={loadMoreTarget}
            errorNotice={failedPage > 1 && errorNotice}
            nextPage={nextPage}
            loading={loading}
            failed={failed}
            onMore={page => readPage.current(page)}
          />
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
      <ReadFailed sx={{mt: 3}} onRetry={props.initialSync.retry} />
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
