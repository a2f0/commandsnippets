/**
 * Timings of the work behind what the app shows, for the HUD's Analytics tab:
 * API requests (`network`: every `fetchApi`, from the request to the end of
 * its body), IndexedDB reads and writes (`idb`: the lists' live queries, the
 * sync's stores, the user's writes) and renders (`render`: a component's
 * render and commit, `useRenderTiming`). An interaction (a tag switch, say)
 * is timed from the click to the paint of the list it opens, so the HUD can
 * lay out what ran in between.
 *
 * Kept in memory, the latest `MAX_TIMINGS` and `MAX_INTERACTIONS`, and only
 * where there is a HUD: production records nothing. A change of the
 * signed-in user clears them (`appState.ts`), as it does the user's data:
 * interactions name the lists they open (a tag's name).
 */
import {environment} from '../environment';

export type TimingKind = 'network' | 'idb' | 'render';

export interface Timing {
  id: number;
  kind: TimingKind;
  /** What ran: `GET /tags_entries`, `useTagEntries`, `EntryList`. */
  name: string;
  /** When it began (`performance.now()`, in ms). */
  start: number;
  /** How long it took, in ms. */
  duration: number;
  /** What it did: a status and size, a row count. */
  detail?: string | undefined;
}

export interface Interaction {
  id: number;
  /** What the user did: `tag switch`. */
  name: string;
  /** The list it opens (`listKey`). */
  target: string;
  start: number;
  /** When the list it opened was painted; null until then. */
  painted: number | null;
}

export interface Metrics {
  timings: readonly Timing[];
  interactions: readonly Interaction[];
}

export const MAX_TIMINGS = 2000;
export const MAX_INTERACTIONS = 20;
/** How often, at most, the HUD hears of new timings. */
export const NOTIFY_MS = 250;

/** The key of a list of entries: a tag's, or all or the untagged ones. */
export const listKey = (list: {tag: string} | {entries: string}): string =>
  'tag' in list ? `tag:${list.tag}` : `entries:${list.entries}`;

/** Whether timings are recorded: everywhere but production. */
export const isRecording = () => environment !== 'production';

let timings: Timing[] = [];
let interactions: Interaction[] = [];
let nextId = 1;
/** The list shown last (`listShown`). */
let shown: string | null = null;
let snapshot: Metrics = {timings: [], interactions: []};
/** When the timings were last cleared: work begun before is not recorded. */
let clearedAt = Number.NEGATIVE_INFINITY;

const listeners = new Set<() => void>();
let notifying: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  notifying = null;
  snapshot = {timings: [...timings], interactions: [...interactions]};
  for (const listener of listeners) {
    listener();
  }
}

/** Tell the HUD, once per `NOTIFY_MS` at most: recording stays cheap. */
function changed(): void {
  notifying ??= setTimeout(notify, NOTIFY_MS);
}

/** Call `listener` when the timings change. Returns the unsubscribe. */
export function subscribeMetrics(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** The timings and interactions as last told (`subscribeMetrics`). */
export const metricsSnapshot = (): Metrics => snapshot;

/**
 * Forget every timing and interaction, and the work still running: a
 * request or query begun before is not recorded when it ends.
 */
export function clearMetrics(): void {
  timings = [];
  interactions = [];
  clearedAt = performance.now();
  if (notifying !== null) {
    clearTimeout(notifying);
  }
  notify();
}

/** Record work of `kind` that ran from `start` to `end`. */
export function recordTiming(
  kind: TimingKind,
  name: string,
  start: number,
  end: number = performance.now(),
  detail?: string
): void {
  if (!isRecording() || start < clearedAt) {
    return;
  }
  timings.push({
    id: nextId++,
    kind,
    name,
    start,
    duration: Math.max(0, end - start),
    detail,
  });
  if (timings.length > MAX_TIMINGS) {
    timings.splice(0, timings.length - MAX_TIMINGS);
  }
  changed();
}

/**
 * `task`, recorded as work of `kind`: until it settles, described by
 * `describe` (its row count, say) or as failed.
 */
export async function timed<T>(
  kind: TimingKind,
  name: string,
  task: () => Promise<T>,
  describe?: (result: T) => string
): Promise<T> {
  if (!isRecording()) {
    return task();
  }
  const start = performance.now();
  try {
    const result = await task();
    recordTiming(kind, name, start, performance.now(), describe?.(result));
    return result;
  } catch (error) {
    recordTiming(kind, name, start, performance.now(), 'failed');
    throw error;
  }
}

/** Call `callback` once the browser has painted the frame being made. */
function afterNextPaint(callback: () => void): void {
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => setTimeout(callback, 0));
  } else {
    setTimeout(callback, 0);
  }
}

/**
 * The latest interaction ends when the frame now being made is painted:
 * unless by then another has begun, or another list is shown.
 */
function endLatestAtPaint(): void {
  const latest = interactions.at(-1);
  if (latest === undefined || latest.painted !== null) {
    return;
  }
  afterNextPaint(() => {
    const index = interactions.length - 1;
    const interaction = interactions[index];
    if (
      interaction?.id !== latest.id ||
      interaction.painted !== null ||
      shown !== interaction.target
    ) {
      return;
    }
    interactions[index] = {...interaction, painted: performance.now()};
    changed();
  });
}

/**
 * The user asked for the list `target` (`listKey`): timed until it is
 * painted (`listShown`), now if it is shown already. An interaction left
 * before its list was shown (another asked for) is never painted.
 */
export function beginInteraction(name: string, target: string): void {
  if (!isRecording()) {
    return;
  }
  interactions.push({
    id: nextId++,
    name,
    target,
    start: performance.now(),
    painted: null,
  });
  if (interactions.length > MAX_INTERACTIONS) {
    interactions.splice(0, interactions.length - MAX_INTERACTIONS);
  }
  changed();
  if (shown === target) {
    endLatestAtPaint();
  }
}

/**
 * The list `target` (`listKey`) is rendered with its own rows: the
 * interaction that asked for it ends when they are painted.
 */
export function listShown(target: string): void {
  if (!isRecording()) {
    return;
  }
  shown = target;
  if (interactions.at(-1)?.target === target) {
    endLatestAtPaint();
  }
}

/** How long after an interaction its timings are counted at most. */
export const INTERACTION_WINDOW_MS = 10_000;
/** How long the app idles after an interaction's paint before it is over. */
export const INTERACTION_IDLE_MS = 100;

/**
 * The timings that began while `interaction` ran, in the order they began:
 * from the click, all those before the paint, and those after that follow
 * on (each beginning within `INTERACTION_IDLE_MS` of the work before it
 * ending: a sync of the tag, say), until the next interaction, and within
 * `INTERACTION_WINDOW_MS`.
 */
export function timingsOf(
  {timings, interactions}: Metrics,
  interaction: Interaction
): Timing[] {
  const next = interactions.find(({start}) => start > interaction.start);
  const during = timings
    .filter(
      ({start}) =>
        start >= interaction.start &&
        (next === undefined || start < next.start) &&
        start - interaction.start <= INTERACTION_WINDOW_MS
    )
    .sort((a, b) => a.start - b.start);
  let reached = interaction.painted ?? interaction.start;
  const followed: Timing[] = [];
  for (const timing of during) {
    if (timing.start > reached + INTERACTION_IDLE_MS) {
      break;
    }
    followed.push(timing);
    reached = Math.max(reached, timing.start + timing.duration);
  }
  return followed;
}

/**
 * How long at least one of `spans` was running between `from` and `to`:
 * overlapping spans count once.
 */
export function busyTime(
  spans: ReadonlyArray<{start: number; duration: number}>,
  from: number,
  to: number
): number {
  const clipped = spans
    .map(({start, duration}) => ({
      begin: Math.max(from, start),
      end: Math.min(to, start + duration),
    }))
    .filter(({begin, end}) => end > begin)
    .sort((a, b) => a.begin - b.begin);
  let total = 0;
  let reached = Number.NEGATIVE_INFINITY;
  for (const {begin, end} of clipped) {
    if (end > reached) {
      total += end - Math.max(begin, reached);
      reached = end;
    }
  }
  return total;
}

export interface TimingStats {
  kind: TimingKind;
  name: string;
  count: number;
  total: number;
  p50: number;
  p95: number;
  max: number;
}

/** The `fraction` quantile of `sorted` (ascending), nearest rank. */
export function quantile(sorted: readonly number[], fraction: number): number {
  if (sorted.length === 0) {
    return 0;
  }
  const rank = Math.ceil(fraction * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))] ?? 0;
}

/** Each kind and name's count and durations, the most time first. */
export function statsOf(timings: readonly Timing[]): TimingStats[] {
  const groups = new Map<
    string,
    {kind: TimingKind; name: string; durations: number[]}
  >();
  for (const {kind, name, duration} of timings) {
    const key = `${kind}|${name}`;
    const group = groups.get(key) ?? {kind, name, durations: []};
    group.durations.push(duration);
    groups.set(key, group);
  }
  return [...groups.values()]
    .map(({kind, name, durations}) => {
      const sorted = [...durations].sort((a, b) => a - b);
      return {
        kind,
        name,
        count: sorted.length,
        total: sorted.reduce((sum, value) => sum + value, 0),
        p50: quantile(sorted, 0.5),
        p95: quantile(sorted, 0.95),
        max: sorted.at(-1) ?? 0,
      };
    })
    .sort((a, b) => b.total - a.total);
}
