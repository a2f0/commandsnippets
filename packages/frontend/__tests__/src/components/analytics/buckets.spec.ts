import type {Analytics} from '@commandsnippets/api-shared/responses';
import {timelineBuckets} from '../../../../src/components/analytics/buckets';

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

it('fills missing days including leap days and both range boundaries', () => {
  expect(timelineBuckets(data)).toEqual([
    {date: '2024-02-28', count: 2},
    {date: '2024-02-29', count: 0},
    {date: '2024-03-01', count: 0},
  ]);
});

it('anchors partial weeks on Monday and months on the first', () => {
  expect(
    timelineBuckets({...data, interval: 'week'}).map(row => row.date)
  ).toEqual(['2024-02-26']);
  expect(
    timelineBuckets({...data, interval: 'month'}).map(row => row.date)
  ).toEqual(['2024-02-01', '2024-03-01']);
});

it('stops at the last supported calendar year', () => {
  expect(
    timelineBuckets({...data, from: '9999-12-30', to: '9999-12-31'})
  ).toEqual([
    {date: '9999-12-30', count: 0},
    {date: '9999-12-31', count: 0},
  ]);
});

it.each(['day', 'week', 'month'] as const)(
  'bounds millennia of %s buckets without losing events',
  interval => {
    const points = timelineBuckets({
      ...data,
      interval,
      from: '0001-01-01',
      to: '9999-12-31',
      timeline: [
        {date: '0001-01-01', count: 2},
        {date: '9999-12-01', count: 5},
      ],
    });
    expect(points.length).toBeLessThanOrEqual(3661);
    expect(points[0]).toMatchObject({date: '0001-01-01', count: 2});
    expect(points.at(-1)).toMatchObject({through: '9999-12-31', count: 5});
    expect(points.reduce((total, point) => total + point.count, 0)).toBe(7);
  }
);

it('combines adjacent periods with inclusive labeled bounds and retains silent periods', () => {
  const points = timelineBuckets({
    ...data,
    from: '2000-01-01',
    to: '2030-01-01',
    timeline: [
      {date: '2000-01-01', count: 2},
      {date: '2000-01-03', count: 3},
      {date: '2000-01-04', count: 7},
    ],
  });
  expect(points.slice(0, 3)).toEqual([
    {date: '2000-01-01', through: '2000-01-03', count: 5},
    {date: '2000-01-04', through: '2000-01-06', count: 7},
    {date: '2000-01-07', through: '2000-01-09', count: 0},
  ]);
});
