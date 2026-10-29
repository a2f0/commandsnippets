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
