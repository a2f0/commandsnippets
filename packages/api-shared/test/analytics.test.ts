import {expect, test} from 'bun:test';
import {analyticsDocumentSchema, analyticsQuerySchema} from '../src';

const query = {
  activity: 'created',
  interval: 'day',
  from: '2024-02-28',
  to: '2024-02-29',
} as const;

test('accepts inclusive leap-day ranges and optional tag ids', () => {
  expect(analyticsQuerySchema.parse(query)).toEqual(query);
  expect(analyticsQuerySchema.parse({...query, tag: '12'}).tag).toBe('12');
});

test('refuses malformed dates, reversed or oversized ranges, and unknown filters', () => {
  for (const change of [
    {from: '2023-02-29'},
    {from: '2024-02-30'},
    {from: '2024-03-01'},
    {from: '2000-01-01'},
    {tag: '1 OR 1'},
    {owner: 'other'},
    {interval: 'year'},
  ]) {
    expect(analyticsQuerySchema.safeParse({...query, ...change}).success).toBe(
      false
    );
  }
});

test('requires nonnegative integer counts and a version on every aggregate', () => {
  const data = {
    ...query,
    version: 1,
    total: 0,
    entries: 0,
    tags: 0,
    timeline: [],
    top_tags: [],
    top_entries: [],
  };
  expect(analyticsDocumentSchema.parse({data})).toEqual({data});
  expect(
    analyticsDocumentSchema.safeParse({data: {...data, total: -1}}).success
  ).toBe(false);
  expect(
    analyticsDocumentSchema.safeParse({data: {...data, version: undefined}})
      .success
  ).toBe(false);
});
