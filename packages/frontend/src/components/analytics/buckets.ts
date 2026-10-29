import type {Analytics} from '@commandsnippets/api-shared/responses';

export const utcDay = (date: Date) => date.toISOString().slice(0, 10);

export function recentRange(days: number) {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - days + 1);
  return {from: utcDay(start), to: utcDay(end)};
}

/** Include silent periods so bar spacing always represents elapsed time. */
export function timelineBuckets(data: Analytics) {
  const date = new Date(`${data.from}T00:00:00Z`);
  if (data.interval === 'month') date.setUTCDate(1);
  if (data.interval === 'week')
    date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  const values = new Map(data.timeline.map(point => [point.date, point.count]));
  const result: Analytics['timeline'] = [];
  const end = Date.parse(data.to);
  while (date.getTime() <= end) {
    const day = utcDay(date);
    result.push({date: day, count: values.get(day) ?? 0});
    if (data.interval === 'month') date.setUTCMonth(date.getUTCMonth() + 1);
    else
      date.setUTCDate(date.getUTCDate() + (data.interval === 'week' ? 7 : 1));
  }
  return result;
}
