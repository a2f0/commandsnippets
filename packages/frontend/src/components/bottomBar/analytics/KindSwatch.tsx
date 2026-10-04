import {Box} from '@mui/material';
import type {TimingKind} from '../../../lib/metrics/timings';
import {useKindColors} from './chartStyle';

/** The color key of a kind, beside its name. */
export const KindSwatch = ({kind}: {kind: TimingKind}) => {
  const colors = useKindColors();
  return (
    <Box
      component="span"
      aria-hidden
      sx={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '2px',
        backgroundColor: colors[kind],
        flexShrink: 0,
      }}
    />
  );
};
