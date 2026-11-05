import type {Analytics} from '@commandsnippets/api-shared/responses';
import {describe, expect, it} from 'vitest';
import {
  type AnalyticsRead,
  type AnalyticsReadEvent,
  transitionAnalyticsRead,
} from '../../../../src/components/analytics/analyticsRead';

const data: Analytics = {
  version: 1,
  activity: 'reused',
  interval: 'day',
  from: '2024-02-28',
  to: '2024-03-01',
  total: 2,
  entries: 1,
  tags: 0,
  timeline: [{date: '2024-02-28', count: 2}],
  top_tags: [],
  top_entries: [],
};

describe('transitionAnalyticsRead', () => {
  it.each<[string, AnalyticsRead, AnalyticsReadEvent, AnalyticsRead]>([
    [
      'a read starts',
      {status: 'loaded', data},
      {type: 'start', request: 2},
      {status: 'loading', request: 2},
    ],
    [
      'a failed slice is read again',
      {status: 'failed'},
      {type: 'start', request: 2},
      {status: 'loading', request: 2},
    ],
    [
      'a newer read replaces the one in flight',
      {status: 'loading', request: 1},
      {type: 'start', request: 2},
      {status: 'loading', request: 2},
    ],
    [
      'the current read loads',
      {status: 'loading', request: 1},
      {type: 'succeed', request: 1, data},
      {status: 'loaded', data},
    ],
    [
      'the current read fails',
      {status: 'loading', request: 1},
      {type: 'fail', request: 1},
      {status: 'failed'},
    ],
    [
      'a replaced read cannot load',
      {status: 'loading', request: 2},
      {type: 'succeed', request: 1, data},
      {status: 'loading', request: 2},
    ],
    [
      'a replaced read cannot fail',
      {status: 'loading', request: 2},
      {type: 'fail', request: 1},
      {status: 'loading', request: 2},
    ],
    [
      'a loaded slice ignores a late failure',
      {status: 'loaded', data},
      {type: 'fail', request: 1},
      {status: 'loaded', data},
    ],
    [
      'a failed slice ignores a late result',
      {status: 'failed'},
      {type: 'succeed', request: 1, data},
      {status: 'failed'},
    ],
  ])('%s', (_name, state, event, next) => {
    expect(transitionAnalyticsRead(state, event)).toEqual(next);
  });

  it('lets only the newest of start(A), start(B) finish', () => {
    const events: AnalyticsReadEvent[] = [
      {type: 'start', request: 1},
      {type: 'start', request: 2},
      {type: 'fail', request: 1},
      {type: 'succeed', request: 2, data},
    ];
    expect(
      events.reduce(transitionAnalyticsRead, {status: 'loading', request: 0})
    ).toEqual({status: 'loaded', data});
  });
});
