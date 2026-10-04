/** The timings (`timings.ts`) as React reads and records them. */
import {
  type ProfilerOnRenderCallback,
  useLayoutEffect,
  useSyncExternalStore,
} from 'react';
import {
  type Metrics,
  metricsSnapshot,
  recordTiming,
  subscribeMetrics,
} from './timings';

/** The timings and interactions recorded, rendering again as they change. */
export function useMetrics(): Metrics {
  return useSyncExternalStore(subscribeMetrics, metricsSnapshot);
}

/**
 * Record each render of the calling component as `render` work named `name`:
 * from `start` (`performance.now()` first thing in the render) to its commit
 * (its children's renders and the DOM changes included; the browser's
 * layout and paint not).
 */
export function useRenderTiming(
  name: string,
  start: number,
  detail?: string
): void {
  useLayoutEffect(() => {
    recordTiming('render', name, start, performance.now(), detail);
  });
}

/**
 * A React Profiler's `onRender`: each commit of the tree it wraps, as
 * `render` work (`React update`, `React mount`), from when React began to
 * render it to the commit, with the time it spent rendering (less than that
 * when it yielded to the browser meanwhile). Only where React profiles: in
 * development, tests and the builds with a HUD (`vite.config.ts`).
 */
export const recordCommit: ProfilerOnRenderCallback = (
  _id,
  phase,
  actualDuration,
  _baseDuration,
  startTime,
  commitTime
) => {
  recordTiming(
    'render',
    `React ${phase}`,
    startTime,
    commitTime,
    `rendering ${actualDuration.toFixed(1)} ms`
  );
};
