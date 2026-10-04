import {Box, Button} from '@mui/material';
import {useMemo, useState} from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import {useMetrics} from '../../../lib/metrics/hooks';
import {
  busyTime,
  clearMetrics,
  type Interaction,
  statsOf,
  type TimingKind,
  timingsOf,
} from '../../../lib/metrics/timings';
import {formatMs, KINDS, useKindLabels} from './chartStyle';
import {InteractionWaterfall} from './InteractionWaterfall';
import {KindSwatch} from './KindSwatch';
import {TimingTable} from './TimingTable';
import {TimingTimeline} from './TimingTimeline';

/** The spans of time the timeline and table can show, in ms (null: all). */
const WINDOWS = [10_000, 60_000, 300_000, null] as const;
type TimeWindow = (typeof WINDOWS)[number];

const selectSx = {
  font: 'inherit',
  fontSize: 12,
  color: 'text.primary',
  backgroundColor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: 0,
  px: 0.5,
  py: 0.25,
  maxWidth: '100%',
} as const;

const heading = {
  m: 0,
  fontSize: 13,
  fontWeight: 600,
  color: 'text.primary',
} as const;

/** When `interaction` began, by the clock. */
const clockTime = ({start}: Interaction) =>
  new Date(performance.timeOrigin + start).toLocaleTimeString();

const Tile = ({
  label,
  value,
  caption,
  kind,
}: {
  label: string;
  value: string;
  caption?: string;
  kind?: TimingKind;
}) => (
  <Box sx={{minWidth: 128}}>
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
        fontSize: 12,
        color: 'text.secondary',
      }}
    >
      {kind !== undefined && <KindSwatch kind={kind} />}
      {label}
    </Box>
    <Box sx={{fontSize: 20, fontWeight: 600, color: 'text.primary'}}>
      {value}
    </Box>
    {caption !== undefined && (
      <Box sx={{fontSize: 12, color: 'text.disabled'}}>{caption}</Box>
    )}
  </Box>
);

/**
 * The HUD's Analytics tab: the timings of the network, IndexedDB and
 * renders (`lib/metrics/`). First an interaction (the latest by default,
 * a tag switch, say) from the click to the paint of its list: how long it
 * took, how long each kind of work was running before the paint, and each
 * timing on one axis. Then every timing over a span of time, and their
 * numbers by name.
 */
export const TimingAnalytics = () => {
  const {t} = useTypedTranslation('menu');
  const kindLabels = useKindLabels();
  const metrics = useMetrics();
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(60_000);

  const {interactions} = metrics;
  const interaction =
    interactions.find(({id}) => id === selectedId) ?? interactions.at(-1);
  const ofInteraction = useMemo(
    () => (interaction === undefined ? [] : timingsOf(metrics, interaction)),
    [metrics, interaction]
  );
  const {from, to, recent} = useMemo(() => {
    const to = performance.now();
    const from =
      timeWindow === null
        ? Math.min(to - 1000, ...metrics.timings.map(({start}) => start))
        : to - timeWindow;
    return {
      from,
      to,
      recent: metrics.timings.filter(({start}) => start >= from),
    };
  }, [metrics, timeWindow]);
  const stats = useMemo(() => statsOf(recent), [recent]);

  const windowLabels: Record<string, string> = {
    '10000': t('timingsWindowTenSeconds'),
    '60000': t('timingsWindowMinute'),
    '300000': t('timingsWindowFiveMinutes'),
    all: t('timingsWindowAll'),
  };

  const interactionEnd =
    interaction === undefined
      ? 0
      : (interaction.painted ??
        Math.max(
          interaction.start,
          ...ofInteraction.map(({start, duration}) => start + duration)
        ));

  return (
    <Box sx={{display: 'flex', flexDirection: 'column', gap: 2, pb: 2}}>
      <Box
        sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}
      >
        <Box component="h3" sx={heading}>
          {t('timingsInteraction')}
        </Box>
        {interactions.length > 0 && (
          <Box
            component="select"
            aria-label={t('timingsInteraction')}
            value={interaction?.id ?? ''}
            onChange={event => setSelectedId(Number(event.target.value))}
            sx={selectSx}
          >
            {[...interactions].reverse().map(option => (
              <option key={option.id} value={option.id}>
                {`${clockTime(option)} · ${option.name} · ${option.target} · ${
                  option.painted === null
                    ? t('timingsNotPainted')
                    : formatMs(option.painted - option.start)
                }`}
              </option>
            ))}
          </Box>
        )}
        <Box sx={{flex: 1}} />
        <Button
          size="small"
          onClick={() => {
            clearMetrics();
            setSelectedId(null);
          }}
          sx={{textTransform: 'none', fontSize: 12, minWidth: 'unset'}}
        >
          {t('timingsClear')}
        </Button>
      </Box>
      {interaction === undefined ? (
        <Box sx={{color: 'text.disabled', fontSize: 12}}>
          {t('timingsNoInteractions')}
        </Box>
      ) : (
        <>
          <Box sx={{display: 'flex', gap: 3, flexWrap: 'wrap'}}>
            <Tile
              label={t('timingsClickToPaint')}
              value={
                interaction.painted === null
                  ? t('timingsNotPainted')
                  : formatMs(interaction.painted - interaction.start)
              }
            />
            {KINDS.map(kind => {
              const ofKind = ofInteraction.filter(
                timing => timing.kind === kind
              );
              return (
                <Tile
                  key={kind}
                  kind={kind}
                  label={t('timingsBusy', {kind: kindLabels[kind]})}
                  value={formatMs(
                    busyTime(ofKind, interaction.start, interactionEnd)
                  )}
                  caption={t('timingsCount', {count: ofKind.length})}
                />
              );
            })}
          </Box>
          <Box sx={{fontSize: 12, color: 'text.disabled', mt: -1}}>
            {t('timingsBusyNote')}
          </Box>
          <InteractionWaterfall
            interaction={interaction}
            timings={ofInteraction}
          />
        </>
      )}
      <Box
        sx={{display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap'}}
      >
        <Box component="h3" sx={heading}>
          {t('timingsAll')}
        </Box>
        <Box
          component="select"
          aria-label={t('timingsWindow')}
          value={timeWindow === null ? 'all' : String(timeWindow)}
          onChange={event =>
            setTimeWindow(
              WINDOWS.find(
                option => String(option ?? 'all') === event.target.value
              ) ?? null
            )
          }
          sx={selectSx}
        >
          {WINDOWS.map(option => {
            const value = option === null ? 'all' : String(option);
            return (
              <option key={value} value={value}>
                {windowLabels[value]}
              </option>
            );
          })}
        </Box>
        <Box
          sx={{
            display: 'flex',
            gap: 1.5,
            fontSize: 12,
            color: 'text.secondary',
          }}
        >
          {KINDS.map(kind => (
            <Box
              key={kind}
              component="span"
              sx={{display: 'inline-flex', alignItems: 'center', gap: 0.75}}
            >
              <KindSwatch kind={kind} />
              {kindLabels[kind]}
            </Box>
          ))}
        </Box>
      </Box>
      {recent.length === 0 ? (
        <Box sx={{color: 'text.disabled', fontSize: 12}}>
          {t('timingsNone')}
        </Box>
      ) : (
        <>
          <TimingTimeline
            timings={recent}
            interactions={interactions}
            from={from}
            to={to}
          />
          <TimingTable stats={stats} />
        </>
      )}
    </Box>
  );
};
