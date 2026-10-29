import type {Analytics} from '@commandsnippets/api-shared/responses';

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

export function recentRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {from: utcDay(start), to: utcDay(end)};
}

export type TimelinePoint = Analytics['timeline'][number] & {through?: string};

/** Fill silent periods, combining adjacent buckets to keep long charts bounded. */
export function timelineBuckets(data: Analytics) {
  const start = new Date(`${data.from}T00:00:00Z`);
  if (data.interval === 'month') start.setUTCDate(1);
  if (data.interval === 'week')
    start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  const days = data.interval === 'week' ? 7 : 1;
  const offset = (date: Date) =>
    data.interval === 'month'
      ? (date.getUTCFullYear() - start.getUTCFullYear()) * 12 +
        date.getUTCMonth() -
        start.getUTCMonth()
      : Math.floor((date.getTime() - start.getTime()) / (days * 86_400_000));
  const at = (index: number) => {
    const date = new Date(start);
    if (data.interval === 'month') date.setUTCMonth(date.getUTCMonth() + index);
    else date.setUTCDate(date.getUTCDate() + index * days);
    return date;
  };
  const end = Date.parse(data.to);
  const periods = offset(new Date(end)) + 1;
  // Preserve the old ten-year daily maximum even for millennia of imported data.
  const stride = Math.max(1, Math.ceil(periods / 3661));
  const result = Array.from(
    {length: Math.ceil(periods / stride)},
    (_, index): TimelinePoint => ({
      date: utcDay(at(index * stride)),
      count: 0,
      ...(stride > 1
        ? {
            through: utcDay(
              new Date(
                Math.min(end, at((index + 1) * stride).getTime() - 86_400_000)
              )
            ),
          }
        : {}),
    })
  );
  for (const point of data.timeline) {
    const bucket =
      result[Math.floor(offset(new Date(`${point.date}T00:00:00Z`)) / stride)];
    if (bucket) bucket.count += point.count;
  }
  return result;
}
