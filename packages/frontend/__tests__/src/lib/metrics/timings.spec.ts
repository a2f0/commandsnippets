import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import * as envModule from '../../../../src/lib/environment';
import {
  beginInteraction,
  busyTime,
  clearMetrics,
  listKey,
  listShown,
  MAX_INTERACTIONS,
  MAX_TIMINGS,
  metricsSnapshot,
  quantile,
  recordTiming,
  statsOf,
  subscribeMetrics,
  type Timing,
  timed,
  timingsOf,
} from '../../../../src/lib/metrics/timings';

beforeEach(() => clearMetrics());
afterEach(() => vi.restoreAllMocks());

/** The timings once the HUD has been told of them. */
const told = () =>
  vi.waitFor(() => {
    const {timings} = metricsSnapshot();
    expect(timings.length).toBeGreaterThan(0);
    return timings;
  });

const timing = (start: number, duration: number): Timing => ({
  id: start,
  kind: 'idb',
  name: 'query',
  start,
  duration,
});

describe('recordTiming', () => {
  it('records work and tells the HUD of it, once for many', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeMetrics(listener);
    recordTiming('network', 'GET /tags', 10, 25, '200');
    recordTiming('idb', 'useTags', 30, 31);

    const timings = await told();

    expect(timings).toEqual([
      expect.objectContaining({
        kind: 'network',
        name: 'GET /tags',
        start: 10,
        duration: 15,
        detail: '200',
      }),
      expect.objectContaining({kind: 'idb', name: 'useTags', duration: 1}),
    ]);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('keeps only the latest timings', async () => {
    for (let index = 0; index < MAX_TIMINGS + 5; index++) {
      recordTiming('render', `render ${index}`, index, index + 1);
    }

    const timings = await told();

    expect(timings).toHaveLength(MAX_TIMINGS);
    expect(timings[0]?.name).toBe('render 5');
  });

  it('records nothing in production, which has no HUD', async () => {
    vi.spyOn(envModule, 'environment', 'get').mockReturnValue('production');
    recordTiming('network', 'GET /tags', 0, 1);
    beginInteraction('tag switch', listKey({tag: 'a'}));

    await new Promise(resolve => setTimeout(resolve, 300));

    expect(metricsSnapshot()).toEqual({timings: [], interactions: []});
  });
});

describe('timed', () => {
  it('records a task with what it did', async () => {
    await expect(
      timed(
        'idb',
        'useTagEntries',
        async () => [1, 2, 3],
        rows => `${rows.length} rows`
      )
    ).resolves.toEqual([1, 2, 3]);

    expect(await told()).toEqual([
      expect.objectContaining({name: 'useTagEntries', detail: '3 rows'}),
    ]);
  });

  it('records a task that failed, and fails as it did', async () => {
    await expect(
      timed('idb', 'write', () => Promise.reject(new Error('no')))
    ).rejects.toThrow('no');

    expect(await told()).toEqual([
      expect.objectContaining({name: 'write', detail: 'failed'}),
    ]);
  });
});

describe('interactions', () => {
  const painted = () =>
    vi.waitFor(() => {
      const [interaction] = metricsSnapshot().interactions;
      expect(interaction?.painted).toEqual(expect.any(Number));
      return interaction;
    });

  it('ends when the list it asked for is shown, at the paint', async () => {
    listShown(listKey({tag: 'a'}));
    beginInteraction('tag switch', listKey({tag: 'b'}));
    listShown(listKey({tag: 'a'}));
    listShown(listKey({tag: 'b'}));

    const interaction = await painted();

    expect(interaction).toEqual(
      expect.objectContaining({name: 'tag switch', target: 'tag:b'})
    );
    expect(interaction?.painted).toBeGreaterThanOrEqual(
      interaction?.start ?? Number.POSITIVE_INFINITY
    );
  });

  it('ends at once when its list is shown already', async () => {
    listShown(listKey({entries: 'all'}));
    beginInteraction('all entries', listKey({entries: 'all'}));

    expect(await painted()).toEqual(
      expect.objectContaining({target: 'entries:all'})
    );
  });

  it('never ends when another is asked for first', async () => {
    listShown(listKey({tag: 'a'}));
    beginInteraction('tag switch', listKey({tag: 'b'}));
    beginInteraction('tag switch', listKey({tag: 'c'}));
    listShown(listKey({tag: 'b'}));
    listShown(listKey({tag: 'c'}));

    await vi.waitFor(() =>
      expect(metricsSnapshot().interactions.at(-1)?.painted).toEqual(
        expect.any(Number)
      )
    );
    expect(metricsSnapshot().interactions[0]?.painted).toBeNull();
  });

  it('keeps only the latest interactions', async () => {
    for (let index = 0; index < MAX_INTERACTIONS + 1; index++) {
      beginInteraction('tag switch', listKey({tag: String(index)}));
    }

    await vi.waitFor(() =>
      expect(metricsSnapshot().interactions).toHaveLength(MAX_INTERACTIONS)
    );
    expect(metricsSnapshot().interactions[0]?.target).toBe('tag:1');
  });
});

describe('timingsOf', () => {
  it('takes the timings that began during an interaction, until the next', () => {
    const first = {id: 1, name: 'a', target: 'tag:a', start: 100, painted: 150};
    const second = {
      id: 2,
      name: 'b',
      target: 'tag:b',
      start: 200,
      painted: null,
    };
    const metrics = {
      timings: [timing(90, 5), timing(100, 5), timing(199, 50), timing(200, 1)],
      interactions: [first, second],
    };

    expect(timingsOf(metrics, first).map(({start}) => start)).toEqual([
      100, 199,
    ]);
    expect(timingsOf(metrics, second).map(({start}) => start)).toEqual([200]);
  });
});

describe('timingsOf, after the paint', () => {
  const interaction = {
    id: 1,
    name: 'tag switch',
    target: 'tag:a',
    start: 0,
    painted: 50,
  };

  it('takes the work that follows on, until the app idles', () => {
    const metrics = {
      // A request after the paint, the store of its answer, then (idle
      // since) a hover.
      timings: [
        timing(600, 1),
        timing(140, 300),
        timing(10, 5),
        timing(445, 2),
      ],
      interactions: [interaction],
    };

    expect(timingsOf(metrics, interaction).map(({start}) => start)).toEqual([
      10, 140, 445,
    ]);
  });

  it('takes what follows the click, when there is no paint', () => {
    const metrics = {
      timings: [timing(20, 10), timing(200, 1)],
      interactions: [{...interaction, painted: null}],
    };

    expect(
      timingsOf(metrics, {...interaction, painted: null}).map(
        ({start}) => start
      )
    ).toEqual([20]);
  });
});

describe('busyTime', () => {
  it('counts overlapping work once, within the span', () => {
    expect(
      busyTime([timing(0, 10), timing(5, 10), timing(30, 10)], 2, 35)
    ).toBe(13 + 5);
  });

  it('is nothing for no work', () => {
    expect(busyTime([], 0, 100)).toBe(0);
  });
});

describe('statsOf', () => {
  it('sums each kind and name, the most time first', () => {
    const stats = statsOf([
      timing(0, 1),
      timing(1, 3),
      {...timing(2, 50), kind: 'network', name: 'GET /tags'},
      timing(3, 2),
    ]);

    expect(stats).toEqual([
      {
        kind: 'network',
        name: 'GET /tags',
        count: 1,
        total: 50,
        p50: 50,
        p95: 50,
        max: 50,
      },
      {kind: 'idb', name: 'query', count: 3, total: 6, p50: 2, p95: 3, max: 3},
    ]);
  });

  it('takes quantiles by nearest rank', () => {
    const sorted = Array.from({length: 100}, (_, index) => index + 1);
    expect(quantile(sorted, 0.5)).toBe(50);
    expect(quantile(sorted, 0.95)).toBe(95);
    expect(quantile([], 0.5)).toBe(0);
  });
});
