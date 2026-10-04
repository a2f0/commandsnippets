import {Box} from '@mui/material';
import {useTheme} from '@mui/material/styles';
import {
  type PointerEvent,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTypedTranslation} from '../../../i18n/hooks';
import type {Interaction, Timing} from '../../../lib/metrics/timings';
import {formatMs, niceTicks, useKindColors, useKindLabels} from './chartStyle';

const HEIGHT = 200;
const MARGIN = {top: 8, right: 12, bottom: 22, left: 52};
/** The durations the y axis spans, in ms (a log scale). */
const LOG_MIN = -1;
const LOG_MAX = 4;
const Y_TICKS = [0.1, 1, 10, 100, 1000, 10_000];
/** How near the pointer a dot is to be the one shown, in px. */
const HOVER_RADIUS = 16;
/** The width until measured (and where it cannot be, as in jsdom). */
const DEFAULT_WIDTH = 600;

const yTickLabel = (ms: number) => (ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`);

/** Where a duration sits on the y axis (a log scale, clamped to it). */
function scaleY(ms: number, plotHeight: number): number {
  const log = Math.min(LOG_MAX, Math.max(LOG_MIN, Math.log10(ms || 0.1)));
  return MARGIN.top + (1 - (log - LOG_MIN) / (LOG_MAX - LOG_MIN)) * plotHeight;
}

/** Where a time sits on the x axis, from `from` over `span` ms. */
const scaleX = (time: number, from: number, span: number, plotWidth: number) =>
  MARGIN.left + ((time - from) / span) * plotWidth;

/** The width of the element `ref` holds, as it changes. */
function useWidth(ref: React.RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === 'undefined') {
      return undefined;
    }
    const observer = new ResizeObserver(([entry]) => {
      if (entry !== undefined && entry.contentRect.width > 0) {
        setWidth(entry.contentRect.width);
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

interface Props {
  timings: readonly Timing[];
  interactions: readonly Interaction[];
  /** The span of time shown (`performance.now()`, in ms). */
  from: number;
  to: number;
}

/**
 * Every timing in a span of time: when it began, and how long it took on a
 * log scale (a 1 ms query and a 1 s request side by side), colored by kind,
 * with the interactions marked. The pointer shows the nearest one.
 */
export const TimingTimeline = ({timings, interactions, from, to}: Props) => {
  const {t} = useTypedTranslation('menu');
  const theme = useTheme();
  const colors = useKindColors();
  const kindLabels = useKindLabels();
  const container = useRef<HTMLDivElement | null>(null);
  const width = useWidth(container);
  const [hovered, setHovered] = useState<number | null>(null);

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const span = Math.max(1, to - from);
  const x = (time: number) => scaleX(time, from, span, plotWidth);
  const y = (ms: number) => scaleY(ms, plotHeight);
  const points = useMemo(
    () =>
      timings
        .filter(({start}) => start >= from && start <= to)
        .map(timing => ({
          timing,
          cx: scaleX(timing.start, from, span, plotWidth),
          cy: scaleY(timing.duration, plotHeight),
        })),
    [timings, from, to, span, plotWidth, plotHeight]
  );
  const secondsTicks = niceTicks(span / 1000, 4).filter(
    seconds => seconds * 1000 <= span
  );
  const hoveredPoint = points.find(({timing}) => timing.id === hovered);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const px = event.clientX - box.left;
    const py = event.clientY - box.top;
    let nearest: number | null = null;
    let best = HOVER_RADIUS * HOVER_RADIUS;
    for (const {timing, cx, cy} of points) {
      const distance = (cx - px) ** 2 + (cy - py) ** 2;
      if (distance <= best) {
        best = distance;
        nearest = timing.id;
      }
    }
    setHovered(nearest);
  };

  const surface = theme.palette.background.paper;
  const muted = theme.palette.text.secondary;

  return (
    <Box ref={container} sx={{position: 'relative', width: '100%'}}>
      <svg
        role="img"
        aria-label={t('timingsTimeline')}
        width={width}
        height={HEIGHT}
        onPointerMove={onPointerMove}
        onPointerLeave={() => setHovered(null)}
        style={{display: 'block', fontSize: 11}}
      >
        {Y_TICKS.map(tick => (
          <g key={tick}>
            <line
              x1={MARGIN.left}
              x2={MARGIN.left + plotWidth}
              y1={y(tick)}
              y2={y(tick)}
              stroke={theme.palette.divider}
              strokeWidth={1}
            />
            <text
              x={MARGIN.left - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              fill={muted}
              style={{fontVariantNumeric: 'tabular-nums'}}
            >
              {yTickLabel(tick)}
            </text>
          </g>
        ))}
        {secondsTicks.map(seconds => (
          <text
            key={seconds}
            x={x(to - seconds * 1000)}
            y={HEIGHT - 6}
            textAnchor={seconds === 0 ? 'end' : 'middle'}
            fill={muted}
            style={{fontVariantNumeric: 'tabular-nums'}}
          >
            {seconds === 0 ? t('timingsNow') : `-${seconds} s`}
          </text>
        ))}
        {interactions
          .filter(({start}) => start >= from && start <= to)
          .map(interaction => (
            <line
              key={interaction.id}
              x1={x(interaction.start)}
              x2={x(interaction.start)}
              y1={MARGIN.top}
              y2={MARGIN.top + plotHeight}
              stroke={theme.palette.text.disabled}
              strokeWidth={1}
            />
          ))}
        {points.map(({timing, cx, cy}) => (
          <circle
            key={timing.id}
            cx={cx}
            cy={cy}
            r={5}
            fill={colors[timing.kind]}
            stroke={surface}
            strokeWidth={2}
          />
        ))}
        {hoveredPoint !== undefined && (
          <circle
            cx={hoveredPoint.cx}
            cy={hoveredPoint.cy}
            r={7}
            fill="none"
            stroke={theme.palette.text.primary}
            strokeWidth={2}
          />
        )}
      </svg>
      {hoveredPoint !== undefined && (
        <Box
          role="tooltip"
          sx={{
            position: 'absolute',
            left: Math.min(hoveredPoint.cx + 12, Math.max(0, width - 260)),
            top: Math.max(0, hoveredPoint.cy - 56),
            width: 248,
            p: 1,
            pointerEvents: 'none',
            backgroundColor: 'background.paper',
            border: 1,
            borderColor: 'divider',
            boxShadow: 2,
            fontSize: 12,
          }}
        >
          <Box sx={{fontWeight: 600, color: 'text.primary'}}>
            {formatMs(hoveredPoint.timing.duration)}
          </Box>
          <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
            <Box
              component="span"
              aria-hidden
              sx={{
                width: 12,
                height: 2,
                backgroundColor: colors[hoveredPoint.timing.kind],
                flexShrink: 0,
              }}
            />
            <Box
              component="span"
              sx={{color: 'text.secondary', overflowWrap: 'anywhere'}}
            >
              {kindLabels[hoveredPoint.timing.kind]}: {hoveredPoint.timing.name}
            </Box>
          </Box>
          {hoveredPoint.timing.detail !== undefined && (
            <Box sx={{color: 'text.secondary'}}>
              {hoveredPoint.timing.detail}
            </Box>
          )}
        </Box>
      )}
    </Box>
  );
};
