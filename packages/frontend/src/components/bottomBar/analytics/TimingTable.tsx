import {Box} from '@mui/material';
import {useTypedTranslation} from '../../../i18n/hooks';
import type {TimingStats} from '../../../lib/metrics/timings';
import {formatMs, useKindLabels} from './chartStyle';
import {KindSwatch} from './KindSwatch';

/** The most rows the table shows: those that took the most time. */
export const MAX_TABLE_ROWS = 40;

const cell = {
  px: 1,
  py: 0.25,
  borderBottom: 1,
  borderColor: 'divider',
  textAlign: 'right',
  whiteSpace: 'nowrap',
} as const;

/**
 * Each kind and name's count and durations (`statsOf`), the most time
 * first: the charts' numbers, readable without them.
 */
export const TimingTable = ({stats}: {stats: readonly TimingStats[]}) => {
  const {t} = useTypedTranslation('menu');
  const kindLabels = useKindLabels();
  const header = (label: string, align: 'left' | 'right' = 'right') => (
    <Box
      component="th"
      scope="col"
      sx={{
        ...cell,
        textAlign: align,
        fontWeight: 600,
        color: 'text.secondary',
      }}
    >
      {label}
    </Box>
  );
  return (
    <Box
      component="table"
      sx={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 12,
        fontVariantNumeric: 'tabular-nums',
        color: 'text.primary',
      }}
    >
      <thead>
        <tr>
          {header(t('timingsColumnKind'), 'left')}
          {header(t('timingsColumnName'), 'left')}
          {header(t('timingsColumnCount'))}
          {header(t('timingsColumnP50'))}
          {header(t('timingsColumnP95'))}
          {header(t('timingsColumnMax'))}
          {header(t('timingsColumnTotal'))}
        </tr>
      </thead>
      <tbody>
        {stats.slice(0, MAX_TABLE_ROWS).map(row => (
          <tr key={`${row.kind}|${row.name}`}>
            <Box component="td" sx={{...cell, textAlign: 'left'}}>
              <Box
                component="span"
                sx={{display: 'inline-flex', alignItems: 'center', gap: 0.75}}
              >
                <KindSwatch kind={row.kind} />
                {kindLabels[row.kind]}
              </Box>
            </Box>
            <Box
              component="td"
              sx={{...cell, textAlign: 'left', whiteSpace: 'normal'}}
            >
              {row.name}
            </Box>
            <Box component="td" sx={cell}>
              {row.count}
            </Box>
            <Box component="td" sx={cell}>
              {formatMs(row.p50)}
            </Box>
            <Box component="td" sx={cell}>
              {formatMs(row.p95)}
            </Box>
            <Box component="td" sx={cell}>
              {formatMs(row.max)}
            </Box>
            <Box component="td" sx={cell}>
              {formatMs(row.total)}
            </Box>
          </tr>
        ))}
      </tbody>
    </Box>
  );
};
