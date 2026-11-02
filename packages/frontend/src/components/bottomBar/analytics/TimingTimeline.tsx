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

interface Point {
  timing: Timing;
  cx: number;
  cy: number;
}

/** The timing nearest the pointer, within `HOVER_RADIUS` of it, if any. */
function nearestTiming(
  points: readonly Point[],
  px: number,
  py: number
): number | null {
  let nearest: number | null = null;
  let best = HOVER_RADIUS * HOVER_RADIUS;
  for (const {timing, cx, cy} of points) {
    const distance = (cx - px) ** 2 + (cy - py) ** 2;
    if (distance <= best) {
      best = distance;
      nearest = timing.id;
    }
  }
  return nearest;
}

/** The duration axis's gridlines and labels (log scale). */
const YAxis = ({plotWidth}: {plotWidth: number}) => {
  const theme = useTheme();
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  return Y_TICKS.map(tick => (
    <g key={tick}>
      <line
        x1={MARGIN.left}
        x2={MARGIN.left + plotWidth}
        y1={scaleY(tick, plotHeight)}
        y2={scaleY(tick, plotHeight)}
        stroke={theme.palette.divider}
        strokeWidth={1}
      />
      <text
        x={MARGIN.left - 6}
        y={scaleY(tick, plotHeight)}
        textAnchor="end"
        dominantBaseline="middle"
        fill={theme.palette.text.secondary}
        style={{fontVariantNumeric: 'tabular-nums'}}
      >
        {yTickLabel(tick)}
      </text>
    </g>
  ));
};

/**
 * The time axis, in seconds before now, and a line at each interaction's
 * click.
 */
const TimeAxis = ({
  interactions,
  from,
  to,
  plotWidth,
}: {
  interactions: readonly Interaction[];
  from: number;
  to: number;
  plotWidth: number;
}) => {
  const {t} = useTypedTranslation('menu');
  const theme = useTheme();
  const span = Math.max(1, to - from);
  const x = (time: number) => scaleX(time, from, span, plotWidth);
  const secondsTicks = niceTicks(span / 1000, 4).filter(
    seconds => seconds * 1000 <= span
  );
  return (
    <>
      {secondsTicks.map(seconds => (
        <text
          key={seconds}
          x={x(to - seconds * 1000)}
          y={HEIGHT - 6}
          textAnchor={seconds === 0 ? 'end' : 'middle'}
          fill={theme.palette.text.secondary}
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
            y2={HEIGHT - MARGIN.bottom}
            stroke={theme.palette.text.disabled}
            strokeWidth={1}
          />
        ))}
    </>
  );
};

/** The hovered timing: its duration, kind, name and detail. */
const TimingTooltip = ({point, width}: {point: Point; width: number}) => {
  const colors = useKindColors();
  const kindLabels = useKindLabels();
  const {timing} = point;
  return (
    <Box
      role="tooltip"
      sx={{
        position: 'absolute',
        left: Math.min(point.cx + 12, Math.max(0, width - 260)),
        top: Math.max(0, point.cy - 56),
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
        {formatMs(timing.duration)}
      </Box>
      <Box sx={{display: 'flex', alignItems: 'center', gap: 0.75}}>
        <Box
          component="span"
          aria-hidden
          sx={{
            width: 12,
            height: 2,
            backgroundColor: colors[timing.kind],
            flexShrink: 0,
          }}
        />
        <Box
          component="span"
          sx={{color: 'text.secondary', overflowWrap: 'anywhere'}}
        >
          {kindLabels[timing.kind]}: {timing.name}
        </Box>
      </Box>
      {timing.detail !== undefined && (
        <Box sx={{color: 'text.secondary'}}>{timing.detail}</Box>
      )}
    </Box>
  );
};

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
  const container = useRef<HTMLDivElement | null>(null);
  const width = useWidth(container);
  const [hovered, setHovered] = useState<number | null>(null);

  const plotWidth = Math.max(1, width - MARGIN.left - MARGIN.right);
  const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
  const span = Math.max(1, to - from);
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
  const hoveredPoint = points.find(({timing}) => timing.id === hovered);

  const onPointerMove = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    setHovered(
      nearestTiming(points, event.clientX - box.left, event.clientY - box.top)
    );
  };

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
        <YAxis plotWidth={plotWidth} />
        <TimeAxis
          interactions={interactions}
          from={from}
          to={to}
          plotWidth={plotWidth}
        />
        {points.map(({timing, cx, cy}) => (
          <circle
            key={timing.id}
            cx={cx}
            cy={cy}
            r={5}
            fill={colors[timing.kind]}
            stroke={theme.palette.background.paper}
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
        <TimingTooltip point={hoveredPoint} width={width} />
      )}
    </Box>
  );
};
