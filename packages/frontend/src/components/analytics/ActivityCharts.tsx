import type {Analytics} from '@commandsnippets/api-shared/responses';
import {
  Box,
  Button,
  ButtonBase,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import {useId, useMemo, useState} from 'react';
import {useWindowSize} from '../../hooks/useWindowSize';
import {useTypedTranslation} from '../../i18n/hooks';
import {currentPath} from '../../lib/router/navigation';
import {Link} from '../../lib/router/Router';
import {entryPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';
import {type TimelinePoint, timelineBuckets} from './buckets';

const panel = {
  p: {xs: 2, sm: 3},
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: 'none',
};

/** Numbers, dates and periods as the language writes them. */
function useFormats() {
  const {i18n} = useTypedTranslation('analytics');
  const number = (value: number) => value.toLocaleString(i18n.language);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  const periodLabel = (point: TimelinePoint) =>
    point.through
      ? `${dateLabel(point.date)} – ${dateLabel(point.through)}`
      : dateLabel(point.date);
  return {number, dateLabel, periodLabel};
}

const Totals = ({data}: {data: Analytics}) => {
  const {t} = useTypedTranslation('analytics');
  const {number} = useFormats();
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {xs: '1fr', sm: 'repeat(3, 1fr)'},
        gap: 2,
        my: 3,
      }}
    >
      {(['total', 'entries', 'tags'] as const).map(key => (
        <Paper key={key} sx={panel}>
          <Typography variant="body2" color="text.secondary">
            {t(key === 'total' ? 'events' : key)}
          </Typography>
          <Typography
            sx={{
              fontSize: 36,
              fontWeight: 600,
              fontVariantNumeric: 'tabular-nums',
              mt: 1,
            }}
          >
            {number(data[key])}
          </Typography>
        </Paper>
      ))}
    </Box>
  );
};

/** Which bars the x axis labels: the first, the last, and the middle when it fits. */
const labeledIndexes = (count: number, narrow: boolean) => [
  ...new Set(
    narrow ? [0, count - 1] : [0, Math.floor((count - 1) / 2), count - 1]
  ),
];

const axisAnchor = (index: number, count: number) => {
  if (index === 0) return 'start';
  return index === count - 1 ? 'end' : 'middle';
};

/** The bar chart of the events per period, with its y and x axes. */
const TimelineSvg = ({
  data,
  points,
  chartId,
}: {
  data: Analytics;
  points: readonly TimelinePoint[];
  chartId: string;
}) => {
  const {t} = useTypedTranslation('analytics');
  const {number, dateLabel, periodLabel} = useFormats();
  const {width} = useWindowSize();
  const chartWidth = Math.min(900, Math.max(280, width - 96));
  const step = (chartWidth - 76) / points.length;
  const max = Math.max(1, ...points.map(point => point.count));
  const y = (value: number) => 215 - (180 * value) / max;
  return (
    <Box
      component="svg"
      role="img"
      aria-labelledby={`${chartId}-title ${chartId}-description`}
      viewBox={`0 0 ${chartWidth} 260`}
      sx={{width: '100%', display: 'block', color: 'text.primary'}}
    >
      <title id={`${chartId}-title`}>{t('timeline')}</title>
      <desc id={`${chartId}-description`}>
        {t('chartDescription', {count: data.total, periods: points.length})}
      </desc>
      {[...new Set([0, Math.ceil(max / 2), max])].map(value => (
        <g key={value}>
          <line
            x1={60}
            x2={chartWidth - 16}
            y1={y(value)}
            y2={y(value)}
            stroke="currentColor"
            opacity={0.15}
          />
          <text
            x={48}
            y={y(value) + 4}
            textAnchor="end"
            fill="currentColor"
            fontSize={12}
          >
            {number(value)}
          </text>
        </g>
      ))}
      {points.map((point, index) => (
        <rect
          key={point.date}
          x={60 + index * step + step * 0.12}
          y={y(point.count)}
          width={step * 0.76}
          height={(point.count / max) * 180}
          fill="currentColor"
          opacity={0.75}
          rx={Math.min(2, step / 8)}
        >
          <title>
            {periodLabel(point)}: {number(point.count)}
          </title>
        </rect>
      ))}
      {labeledIndexes(points.length, chartWidth < 480).map(index => (
        <text
          key={index}
          x={60 + (index + 0.5) * step}
          y={246}
          textAnchor={axisAnchor(index, points.length)}
          fill="currentColor"
          fontSize={12}
        >
          {dateLabel(points[index]?.date ?? data.from)}
        </text>
      ))}
    </Box>
  );
};

/** The chart's values, as a table. */
const TimelineTable = ({
  id,
  points,
}: {
  id: string;
  points: readonly TimelinePoint[];
}) => {
  const {t} = useTypedTranslation('analytics');
  const {number, periodLabel} = useFormats();
  return (
    <Box id={id} sx={{maxHeight: 320, overflow: 'auto'}}>
      <Table size="small" aria-label={t('timeline')}>
        <TableHead>
          <TableRow>
            <TableCell>{t('period')}</TableCell>
            <TableCell align="right">{t('count')}</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {points.map(point => (
            <TableRow key={point.date}>
              <TableCell component="th" scope="row">
                {periodLabel(point)}
              </TableCell>
              <TableCell align="right">{number(point.count)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Box>
  );
};

const Timeline = ({data}: {data: Analytics}) => {
  const {t} = useTypedTranslation('analytics');
  const [showData, setShowData] = useState(false);
  const chartId = useId();
  const points = useMemo(() => timelineBuckets(data), [data]);
  return (
    <Paper sx={panel}>
      <Box
        sx={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 2,
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <Typography variant="h6" component="h2">
          {t('timeline')}
        </Typography>
        <Button
          size="small"
          onClick={() => setShowData(value => !value)}
          aria-expanded={showData}
          aria-controls={`${chartId}-data`}
        >
          {t(showData ? 'hideData' : 'showData')}
        </Button>
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{mt: 0.5}}>
        {t('partialPeriods')}
        {points[0]?.through && ` ${t('combinedPeriods')}`}
      </Typography>
      <Box sx={{overflowX: 'auto', mt: 2}}>
        <TimelineSvg data={data} points={points} chartId={chartId} />
      </Box>
      {showData && <TimelineTable id={`${chartId}-data`} points={points} />}
    </Paper>
  );
};

type RankingKey = 'top_tags' | 'top_entries';
type Ranked = Analytics[RankingKey][number];

const rankButtonSx = {
  width: '100%',
  display: 'block',
  textAlign: 'left',
  p: 1,
  borderRadius: 1,
  '&:hover, &.Mui-focusVisible': {
    bgcolor: 'action.hover',
    outline: '1px solid currentColor',
  },
} as const;

/**
 * A ranked tag or entry, its count, and a bar of it against the first: a
 * tag filters the analytics by it, an entry opens its page (which returns
 * here).
 */
const RankedRow = ({
  row,
  top,
  tag,
  owner,
  onTag,
}: {
  row: Ranked;
  /** The first row's count, the bars' full width. */
  top: number;
  tag: boolean;
  owner: string;
  onTag: (id: string) => void;
}) => {
  const {t} = useTypedTranslation('analytics');
  const {number} = useFormats();
  const path = entryPath(owner, row.id);
  const action = tag
    ? {
        onClick: () => onTag(row.id),
        'aria-label': t('tagFiltered', {name: row.name, count: row.count}),
      }
    : {
        component: Link,
        to: path,
        onClick: () =>
          useAppState.getState().setEntryReturnPath(path, currentPath()),
      };
  return (
    <Box component="li" sx={{mb: 1}}>
      <ButtonBase {...action} sx={rankButtonSx}>
        <Box
          sx={{display: 'flex', justifyContent: 'space-between', gap: 2, mb: 1}}
        >
          <Typography variant="body2" sx={{overflowWrap: 'anywhere'}}>
            {row.name}
          </Typography>
          <Typography variant="body2" sx={{fontVariantNumeric: 'tabular-nums'}}>
            {number(row.count)}
          </Typography>
        </Box>
        <Box
          aria-hidden="true"
          sx={{height: 5, bgcolor: 'action.hover', borderRadius: 1}}
        >
          <Box
            sx={{
              height: '100%',
              width: `${(row.count / (top || 1)) * 100}%`,
              bgcolor: 'text.secondary',
              borderRadius: 1,
            }}
          />
        </Box>
      </ButtonBase>
    </Box>
  );
};

const Ranking = ({
  rows,
  tags,
  owner,
  onTag,
}: {
  rows: readonly Ranked[];
  tags: boolean;
  owner: string;
  onTag: (id: string) => void;
}) => {
  const {t} = useTypedTranslation('analytics');
  const title = t(tags ? 'topTags' : 'topEntries');
  return (
    <Paper sx={panel}>
      <Typography component="h2" variant="h6">
        {title}
      </Typography>
      <Typography color="text.secondary" variant="body2" sx={{mt: 0.5, mb: 2}}>
        {t('rankNote')}
      </Typography>
      <Box
        component="ol"
        aria-label={title}
        sx={{listStyle: 'none', p: 0, m: 0}}
      >
        {rows.map(row => (
          <RankedRow
            key={row.id}
            row={row}
            top={rows[0]?.count ?? 0}
            tag={tags}
            owner={owner}
            onTag={onTag}
          />
        ))}
      </Box>
    </Paper>
  );
};

export const ActivityCharts = ({
  data,
  owner,
  onTag,
}: {
  data: Analytics;
  owner: string;
  onTag: (id: string) => void;
}) => {
  const {t} = useTypedTranslation('analytics');
  return (
    <>
      <Totals data={data} />
      {data.total === 0 ? (
        <Paper sx={panel}>
          <Typography role="status" sx={{py: 5, textAlign: 'center'}}>
            {t('empty')}
          </Typography>
        </Paper>
      ) : (
        <>
          <Timeline data={data} />
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {xs: '1fr', md: 'repeat(2, minmax(0, 1fr))'},
              gap: 2,
              mt: 2,
            }}
          >
            <Ranking
              rows={data.top_tags}
              tags={true}
              owner={owner}
              onTag={onTag}
            />
            {/* Entries take no part in a tag's creation. */}
            {data.activity !== 'tags_created' && (
              <Ranking
                rows={data.top_entries}
                tags={false}
                owner={owner}
                onTag={onTag}
              />
            )}
          </Box>
        </>
      )}
    </>
  );
};
