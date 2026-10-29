import type {AnalyticsParams} from '@commandsnippets/api-shared/requests';
import {
  type Analytics,
  analyticsActivitySchema,
  analyticsIntervalSchema,
  isAnalyticsRange,
} from '@commandsnippets/api-shared/responses';
import {Refresh} from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  MenuItem,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import {useLiveQuery} from 'dexie-react-hooks';
import {useEffect, useMemo, useState} from 'react';
import {ActivityCharts} from '../components/analytics/ActivityCharts';
import {recentRange} from '../components/analytics/buckets';
import {DetailPage} from '../components/DetailPage';
import {useCookieLogout} from '../hooks/useCookieLogout';
import {useTypedTranslation} from '../i18n/hooks';
import {UserMismatchError} from '../lib/api/apiClient';
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
  const [data, setData] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setFailed(false);
    setData(null);
    void readAnalytics(session, params, controller.signal)
      .then(result => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          if (
            error instanceof UserMismatchError ||
            error instanceof SyncUserError
          )
            void leaveForeignSession(session.username);
          else console.warn('WARNING: analytics could not be read:', error);
          setFailed(true);
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
          disabled={!data && !failed}
          onClick={() => setAttempt(value => value + 1)}
        >
          {t('refresh')}
        </Button>
      </Box>
      {failed ? (
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
      ) : data ? (
        <ActivityCharts data={data} owner={session.owner} onTag={onTag} />
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
      tag: tag || undefined,
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
  const tagOptions = (tags ?? []).filter(
    tag => !tag.attributes.is_deleted && /^\d+$/.test(tag.id)
  );
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
      <Paper variant="outlined" sx={{p: {xs: 2, sm: 3}, borderRadius: 2}}>
        <Box sx={{display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2}}>
          {([30, 90, 365] as const).map(days => (
            <Button
              key={days}
              size="small"
              variant="outlined"
              onClick={() =>
                setParams(current => ({
                  ...current,
                  ...recentRange(days),
                  interval:
                    days === 30 ? 'day' : days === 90 ? 'week' : 'month',
                }))
              }
            >
              {t(days === 30 ? 'last30' : days === 90 ? 'last90' : 'last365')}
            </Button>
          ))}
        </Box>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: '1.3fr 1fr 1fr 0.8fr 1fr',
            },
            gap: 2,
          }}
        >
          <TextField
            select
            size="small"
            label={t('activity')}
            value={params.activity}
            onChange={event =>
              setParams(current => ({
                ...current,
                activity: event.target.value as AnalyticsParams['activity'],
              }))
            }
          >
            {analyticsActivitySchema.options.map(activity => (
              <MenuItem key={activity} value={activity}>
                {t(activity)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            size="small"
            type="date"
            label={t('from')}
            sx={{colorScheme: theme => theme.palette.mode}}
            value={params.from}
            slotProps={{
              inputLabel: {shrink: true},
              htmlInput: {'aria-label': t('from')},
            }}
            onChange={event =>
              setParams(current => ({...current, from: event.target.value}))
            }
          />
          <TextField
            size="small"
            type="date"
            label={t('to')}
            sx={{colorScheme: theme => theme.palette.mode}}
            value={params.to}
            slotProps={{
              inputLabel: {shrink: true},
              htmlInput: {'aria-label': t('to')},
            }}
            onChange={event =>
              setParams(current => ({...current, to: event.target.value}))
            }
          />
          <TextField
            select
            size="small"
            label={t('interval')}
            value={params.interval}
            onChange={event =>
              setParams(current => ({
                ...current,
                interval: event.target.value as AnalyticsParams['interval'],
              }))
            }
          >
            {(['day', 'week', 'month'] as const).map(interval => (
              <MenuItem key={interval} value={interval}>
                {t(interval)}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            select
            size="small"
            label={t('tag')}
            slotProps={{
              select: {displayEmpty: true},
              inputLabel: {shrink: true},
            }}
            value={params.tag ?? ''}
            onChange={event => setTag(event.target.value)}
          >
            <MenuItem value="">{t('allTags')}</MenuItem>
            {params.tag && !tagOptions.some(tag => tag.id === params.tag) && (
              <MenuItem value={params.tag}>{params.tag}</MenuItem>
            )}
            {tagOptions.map(tag => (
              <MenuItem key={tag.id} value={tag.id}>
                {tag.attributes.name}
              </MenuItem>
            ))}
          </TextField>
        </Box>
        <Typography variant="body2" color="text.secondary" sx={{mt: 2}}>
          {t(`${params.activity}Note`)}
        </Typography>
        {params.tag &&
          (params.activity === 'created' || params.activity === 'reused') && (
            <Typography variant="body2" color="text.secondary" sx={{mt: 1}}>
              {t('tagCohortNote')}
            </Typography>
          )}
      </Paper>
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
