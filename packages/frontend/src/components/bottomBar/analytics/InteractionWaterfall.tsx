import {Box} from '@mui/material';
import {useState} from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import type {Interaction, Timing} from '../../../lib/metrics/timings';
import {formatMs, niceTicks, useKindColors, useKindLabels} from './chartStyle';

/** The most rows the waterfall shows; the table has the rest. */
export const MAX_WATERFALL_ROWS = 60;

const LABEL_WIDTH = 220;
const VALUE_WIDTH = 64;
const GAP = 8;
const ROW_HEIGHT = 18;
const BAR_HEIGHT = 10;

const columns = {
  display: 'grid',
  gridTemplateColumns: `${LABEL_WIDTH}px minmax(0, 1fr) ${VALUE_WIDTH}px`,
  columnGap: `${GAP}px`,
  alignItems: 'center',
};

interface Props {
  interaction: Interaction;
  /** The timings that ran during it (`timingsOf`). */
  timings: readonly Timing[];
}

/**
 * What ran during an interaction, a row each in the order they began, on
 * one time axis from the click, with the paint of the list it opened marked:
 * where the time went, and what ran before the list showed.
 */
export const InteractionWaterfall = ({interaction, timings}: Props) => {
  const {t} = useTypedTranslation('menu');
  const colors = useKindColors();
  const kindLabels = useKindLabels();
  const [focused, setFocused] = useState<Timing | null>(null);

  const rows = [...timings].sort((a, b) => a.start - b.start);
  const shown = rows.slice(0, MAX_WATERFALL_ROWS);
  const painted =
    interaction.painted === null
      ? null
      : interaction.painted - interaction.start;
  const lastEnd = Math.max(
    0,
    ...rows.map(({start, duration}) => start + duration - interaction.start)
  );
  const ticks = niceTicks(Math.max(painted ?? 0, lastEnd));
  const domain = ticks.at(-1) ?? 1;
  const at = (ms: number) => `${(Math.max(0, ms) / domain) * 100}%`;
  const tickShift = (index: number) =>
    index === 0 ? '0' : index === ticks.length - 1 ? '-100%' : '-50%';

  return (
    <Box sx={{fontSize: 12}}>
      <Box sx={{position: 'relative'}}>
        <Box sx={{...columns, height: 32}}>
          <span />
          <Box sx={{position: 'relative', height: '100%'}}>
            {painted !== null && (
              <Box
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: at(painted),
                  transform: painted / domain > 0.5 ? 'translateX(-100%)' : '',
                  px: 0.5,
                  color: 'text.primary',
                  whiteSpace: 'nowrap',
                }}
              >
                {t('timingsPainted')} {formatMs(painted)}
              </Box>
            )}
            {ticks.map((tick, index) => (
              <Box
                key={tick}
                sx={{
                  position: 'absolute',
                  bottom: 0,
                  left: at(tick),
                  transform: `translateX(${tickShift(index)})`,
                  color: 'text.secondary',
                  fontVariantNumeric: 'tabular-nums',
                  whiteSpace: 'nowrap',
                }}
              >
                {formatMs(tick)}
              </Box>
            ))}
          </Box>
          <span />
        </Box>
        {/* The grid and the paint, behind the rows' track column. */}
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: 32,
            bottom: 0,
            left: LABEL_WIDTH + GAP,
            right: VALUE_WIDTH + GAP,
            pointerEvents: 'none',
          }}
        >
          {ticks.map(tick => (
            <Box
              key={tick}
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: at(tick),
                borderLeft: 1,
                borderColor: 'divider',
              }}
            />
          ))}
          {painted !== null && (
            <Box
              sx={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: at(painted),
                borderLeft: 2,
                borderColor: 'text.primary',
              }}
            />
          )}
        </Box>
        <Box
          component="ul"
          aria-label={t('timingsWaterfall')}
          sx={{listStyle: 'none', m: 0, p: 0, position: 'relative'}}
          onMouseLeave={() => setFocused(null)}
        >
          {shown.map(timing => {
            const isFocused = focused?.id === timing.id;
            return (
              <Box
                component="li"
                key={timing.id}
                tabIndex={0}
                onMouseEnter={() => setFocused(timing)}
                onFocus={() => setFocused(timing)}
                sx={{
                  ...columns,
                  height: ROW_HEIGHT,
                  outline: 'none',
                  backgroundColor: isFocused ? 'action.hover' : 'transparent',
                }}
              >
                <Box
                  sx={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    color: isFocused ? 'text.primary' : 'text.secondary',
                  }}
                >
                  {timing.name}
                </Box>
                <Box sx={{position: 'relative', height: '100%'}}>
                  <Box
                    data-testid="waterfall-bar"
                    sx={{
                      position: 'absolute',
                      top: (ROW_HEIGHT - BAR_HEIGHT) / 2,
                      height: BAR_HEIGHT,
                      left: at(timing.start - interaction.start),
                      width: at(timing.duration),
                      minWidth: 2,
                      borderRadius: '2px',
                      backgroundColor: colors[timing.kind],
                    }}
                  />
                </Box>
                <Box
                  sx={{
                    textAlign: 'right',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'text.primary',
                  }}
                >
                  {formatMs(timing.duration)}
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
      {rows.length > shown.length && (
        <Box sx={{color: 'text.disabled', mt: 0.5}}>
          {t('timingsMore', {count: rows.length - shown.length})}
        </Box>
      )}
      <Box
        aria-live="polite"
        sx={{
          mt: 1,
          minHeight: 18,
          color: focused === null ? 'text.disabled' : 'text.primary',
          overflowWrap: 'anywhere',
        }}
      >
        {focused === null
          ? t('timingsHoverHint')
          : [
              focused.name,
              kindLabels[focused.kind],
              t('timingsStartsAt', {
                offset: formatMs(focused.start - interaction.start),
                duration: formatMs(focused.duration),
              }),
              focused.detail,
            ]
              .filter(part => part !== undefined)
              .join(' · ')}
      </Box>
    </Box>
  );
};
