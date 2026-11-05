import type {AnalyticsParams} from '@commandsnippets/api-shared/requests';
import {
  analyticsActivitySchema,
  analyticsIntervalSchema,
  isAnalyticsRange,
} from '@commandsnippets/api-shared/responses';
import Refresh from '@mui/icons-material/Refresh';
import {Alert, Box, Button, Typography} from '@mui/material';
import {useLiveQuery} from 'dexie-react-hooks';
import {useEffect, useMemo, useReducer, useRef, useState} from 'react';
import {ActivityCharts} from '../components/analytics/ActivityCharts';
import {AnalyticsFilters} from '../components/analytics/AnalyticsFilters';
import {transitionAnalyticsRead} from '../components/analytics/analyticsRead';
import {recentRange} from '../components/analytics/buckets';
import {DetailPage} from '../components/DetailPage';
import {useCookieLogout} from '../hooks/useCookieLogout';
import {useTypedTranslation} from '../i18n/hooks';
import {UserMismatchError} from '../lib/api/errors';
import {toSearchParams} from '../lib/api/searchParams';
import {readAnalytics} from '../lib/data/analytics';
import {useOwner, useSession, useTags} from '../lib/data/hooks';
import {useCollectionSync} from '../lib/data/useSync';
import {currentPath, navigate, useSearchParam} from '../lib/router/navigation';
import {Navigate} from '../lib/router/Router';
import {leaveForeignSession} from '../lib/state/appState';
import {heldVersion} from '../lib/sync/dataVersion';
import type {SyncSession} from '../lib/sync/session';
import {SyncUserError} from '../lib/sync/sync';

const Results = ({
  session,
  params,
  onTag,
}: {
  session: SyncSession;
  params: AnalyticsParams;
  onTag: (id: string) => void;
}) => {
  const {t} = useTypedTranslation('analytics');
  const [read, dispatch] = useReducer(transitionAnalyticsRead, {
    status: 'loading',
    request: 0,
  });
  const reads = useRef(0);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    reads.current += 1;
    const request = reads.current;
    dispatch({type: 'start', request});
    void readAnalytics(session, params, controller.signal)
      .then(data => {
        if (!controller.signal.aborted)
          dispatch({type: 'succeed', request, data});
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          if (
            error instanceof UserMismatchError ||
            error instanceof SyncUserError
          )
            void leaveForeignSession(session.username);
          else console.warn('WARNING: analytics could not be read:', error);
          dispatch({type: 'fail', request});
        }
      });
    const reconnect = () => setAttempt(value => value + 1);
    window.addEventListener('online', reconnect);
    return () => {
      controller.abort();
      window.removeEventListener('online', reconnect);
    };
  }, [session, params, attempt]);
  return (
    <Box sx={{mt: 2}}>
      <Box sx={{display: 'flex', justifyContent: 'flex-end'}}>
        <Button
          startIcon={<Refresh />}
          disabled={read.status === 'loading'}
          onClick={() => setAttempt(value => value + 1)}
        >
          {t('refresh')}
        </Button>
      </Box>
      {read.status === 'failed' ? (
        <Alert
          severity="warning"
          action={
            <Button
              color="inherit"
              onClick={() => setAttempt(value => value + 1)}
            >
              {t('retry')}
            </Button>
          }
        >
          {t('failed')}
        </Alert>
      ) : read.status === 'loaded' ? (
        <ActivityCharts data={read.data} owner={session.owner} onTag={onTag} />
      ) : (
        <Typography role="status" sx={{py: 6, textAlign: 'center'}}>
          {t('loading')}
        </Typography>
      )}
    </Box>
  );
};

const Dashboard = ({
  session,
  syncStatus,
}: {
  session: SyncSession;
  syncStatus: {failed: boolean; retry: () => void};
}) => {
  const {t} = useTypedTranslation('analytics');
  const tags = useTags();
  const [defaults] = useState(() => recentRange(90));
  const activity = useSearchParam('activity');
  const interval = useSearchParam('interval');
  const from = useSearchParam('from');
  const to = useSearchParam('to');
  const tag = useSearchParam('tag');
  const params = useMemo<AnalyticsParams>(
    () => ({
      activity: analyticsActivitySchema.safeParse(activity).data ?? 'created',
      interval: analyticsIntervalSchema.safeParse(interval).data ?? 'week',
      from: from ?? defaults.from,
      to: to ?? defaults.to,
      tag: tag && /^[1-9]\d*$/.test(tag) ? tag : undefined,
    }),
    [activity, interval, from, to, tag, defaults]
  );
  const setParams = (update: (current: AnalyticsParams) => AnalyticsParams) => {
    navigate(
      `${currentPath().split('?')[0]}?${toSearchParams(update(params))}`,
      {replace: true}
    );
  };
  const version = useLiveQuery(
    () => heldVersion(session.db, session.owner),
    [session]
  );
  const valid = isAnalyticsRange(params.from, params.to);
  const setTag = (tag: string) =>
    setParams(current => ({...current, tag: tag || undefined}));
  return (
    <DetailPage
      id="analyticsPage"
      backId="analyticsBack"
      backTo={`/${encodeURIComponent(session.owner)}?entries=all`}
      backLabel={t('back')}
      syncStatus={syncStatus}
    >
      <Typography variant="overline" color="text.secondary">
        {session.owner}
      </Typography>
      <Typography variant="h4" component="h1">
        {t('title')}
      </Typography>
      <Typography color="text.secondary" sx={{mt: 1, mb: 3}}>
        {t('description')}
      </Typography>
      <AnalyticsFilters
        params={params}
        setParams={setParams}
        tags={tags ?? []}
        setTag={setTag}
      />
      {!valid ? (
        <Alert severity="warning" sx={{mt: 2}}>
          {t('invalidRange')}
        </Alert>
      ) : version === undefined ? (
        <Typography role="status" sx={{py: 6}}>
          {t('loading')}
        </Typography>
      ) : (
        <Results
          key={`${version}:${JSON.stringify(params)}`}
          session={session}
          params={params}
          onTag={setTag}
        />
      )}
      <Typography variant="body2" color="text.secondary" sx={{mt: 3}}>
        {t('counting')}
      </Typography>
    </DetailPage>
  );
};

const AnalyticsContent = () => {
  useCookieLogout();
  const session = useSession();
  const syncStatus = useCollectionSync();
  return session ? (
    <Dashboard key={session.owner} session={session} syncStatus={syncStatus} />
  ) : null;
};

export const AnalyticsPage = () => {
  const owner = useOwner();
  if (owner === null || owner.readOnly)
    return (
      <Navigate
        to={owner ? `/${encodeURIComponent(owner.owner)}` : '/'}
        replace
      />
    );
  return <AnalyticsContent key={owner.owner} />;
};
