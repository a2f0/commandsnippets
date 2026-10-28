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
import {Link} from '../../lib/router/Router';
import {analyticsPath, entryPath} from '../../lib/router/route';
import {useAppState} from '../../lib/state/appState';
import {timelineBuckets} from './buckets';

const panel = {
  p: {xs: 2, sm: 3},
  border: 1,
  borderColor: 'divider',
  borderRadius: 2,
  boxShadow: 'none',
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
  const {t, i18n} = useTypedTranslation('analytics');
  const [showData, setShowData] = useState(false);
  const chartId = useId();
  const points = useMemo(() => timelineBuckets(data), [data]);
  const max = Math.max(1, ...points.map(point => point.count));
  const number = (value: number) => value.toLocaleString(i18n.language);
  const dateLabel = (date: string) =>
    new Intl.DateTimeFormat(i18n.language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(`${date}T00:00:00Z`));
  const {width} = useWindowSize();
  const chartWidth = Math.min(900, Math.max(280, width - 96));
  const plotWidth = chartWidth - 76;
  const step = plotWidth / points.length;
  return (
    <>
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
      {data.total === 0 ? (
        <Paper sx={panel}>
          <Typography role="status" sx={{py: 5, textAlign: 'center'}}>
            {t('empty')}
          </Typography>
        </Paper>
      ) : (
        <>
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
            </Typography>
            <Box sx={{overflowX: 'auto', mt: 2}}>
              <Box
                component="svg"
                role="img"
                aria-labelledby={`${chartId}-title ${chartId}-description`}
                viewBox={`0 0 ${chartWidth} 260`}
                sx={{
                  width: '100%',
                  display: 'block',
                  color: 'text.primary',
                }}
              >
                <title id={`${chartId}-title`}>{t('timeline')}</title>
                <desc id={`${chartId}-description`}>
                  {t('chartDescription', {
                    count: data.total,
                    periods: points.length,
                  })}
                </desc>
                {[...new Set([0, Math.ceil(max / 2), max])].map(value => (
                  <g key={value}>
                    <line
                      x1={60}
                      x2={chartWidth - 16}
                      y1={215 - (180 * value) / max}
                      y2={215 - (180 * value) / max}
                      stroke="currentColor"
                      opacity={0.15}
                    />
                    <text
                      x={48}
                      y={219 - (180 * value) / max}
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
                    y={215 - (point.count / max) * 180}
                    width={step * 0.76}
                    height={(point.count / max) * 180}
                    fill="currentColor"
                    opacity={0.75}
                    rx={Math.min(2, step / 8)}
                  >
                    <title>
                      {dateLabel(point.date)}: {number(point.count)}
                    </title>
                  </rect>
                ))}
                {(chartWidth < 480
                  ? [0, points.length - 1]
                  : [0, Math.floor((points.length - 1) / 2), points.length - 1]
                )
                  .filter((index, i, all) => all.indexOf(index) === i)
                  .map(index => (
                    <text
                      key={index}
                      x={60 + (index + 0.5) * step}
                      y={246}
                      textAnchor={
                        index === 0
                          ? 'start'
                          : index === points.length - 1
                            ? 'end'
                            : 'middle'
                      }
                      fill="currentColor"
                      fontSize={12}
                    >
                      {dateLabel(points[index]?.date ?? data.from)}
                    </text>
                  ))}
              </Box>
            </Box>
            {showData && (
              <Box
                id={`${chartId}-data`}
                sx={{maxHeight: 320, overflow: 'auto'}}
              >
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
                          {dateLabel(point.date)}
                        </TableCell>
                        <TableCell align="right">
                          {number(point.count)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </Paper>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {xs: '1fr', md: 'repeat(2, minmax(0, 1fr))'},
              gap: 2,
              mt: 2,
            }}
          >
            {(['top_tags', 'top_entries'] as const)
              .filter(
                key => key !== 'top_entries' || data.activity !== 'tags_created'
              )
              .map(key => (
                <Paper key={key} sx={panel}>
                  <Typography component="h2" variant="h6">
                    {t(key === 'top_tags' ? 'topTags' : 'topEntries')}
                  </Typography>
                  <Typography
                    color="text.secondary"
                    variant="body2"
                    sx={{mt: 0.5, mb: 2}}
                  >
                    {t('rankNote')}
                  </Typography>
                  <Box
                    component="ol"
                    aria-label={t(
                      key === 'top_tags' ? 'topTags' : 'topEntries'
                    )}
                    sx={{listStyle: 'none', p: 0, m: 0}}
                  >
                    {data[key].map(row => (
                      <Box component="li" key={row.id} sx={{mb: 1}}>
                        <ButtonBase
                          {...(key === 'top_tags'
                            ? {
                                onClick: () => onTag(row.id),
                                'aria-label': t('tagFiltered', {
                                  name: row.name,
                                }),
                              }
                            : {
                                component: Link,
                                to: entryPath(owner, row.id),
                                onClick: () =>
                                  useAppState
                                    .getState()
                                    .setEntryReturnPath(
                                      entryPath(owner, row.id),
                                      analyticsPath(owner)
                                    ),
                              })}
                          sx={{
                            width: '100%',
                            display: 'block',
                            textAlign: 'left',
                            p: 1,
                            borderRadius: 1,
                            '&:hover, &.Mui-focusVisible': {
                              bgcolor: 'action.hover',
                              outline: '1px solid currentColor',
                            },
                          }}
                        >
                          <Box
                            sx={{
                              display: 'flex',
                              justifyContent: 'space-between',
                              gap: 2,
                              mb: 1,
                            }}
                          >
                            <Typography
                              variant="body2"
                              sx={{overflowWrap: 'anywhere'}}
                            >
                              {row.name}
                            </Typography>
                            <Typography
                              variant="body2"
                              sx={{fontVariantNumeric: 'tabular-nums'}}
                            >
                              {number(row.count)}
                            </Typography>
                          </Box>
                          <Box
                            aria-hidden="true"
                            sx={{
                              height: 5,
                              bgcolor: 'action.hover',
                              borderRadius: 1,
                            }}
                          >
                            <Box
                              sx={{
                                height: '100%',
                                width: `${(row.count / (data[key][0]?.count || 1)) * 100}%`,
                                bgcolor: 'text.secondary',
                                borderRadius: 1,
                              }}
                            />
                          </Box>
                        </ButtonBase>
                      </Box>
                    ))}
                  </Box>
                </Paper>
              ))}
          </Box>
        </>
      )}
    </>
  );
};
