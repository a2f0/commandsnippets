/** UTC timestamp for HTML time elements, with millisecond precision. */
export const timestampWithZone = (value: string): string => {
  const milliseconds = value.replace(/(\.\d{3})\d+/, '$1');
  return /(?:[zZ]|[+-]\d\d:\d\d)$/.test(milliseconds)
    ? milliseconds
    : `${milliseconds}Z`;
};

type TimeStyle = 'short' | 'medium';

/**
 * The formatters made so far, by locale and time style: making one costs
 * far more than formatting with it, and tables format a timestamp per row.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterOf(locale: string, timeStyle: TimeStyle) {
  const key = `${locale}|${timeStyle}`;
  let formatter = formatters.get(key);
  if (formatter === undefined) {
    formatter = new Intl.DateTimeFormat(locale, {
      dateStyle: 'medium',
      timeStyle,
    });
    formatters.set(key, formatter);
  }
  return formatter;
}

/**
 * Format an API timestamp for display. The API sends naive UTC
 * (`2026-09-28T11:42:49.185000`); without a zone, Date would read it as local
 * time.
 */
export function formatTimestamp(
  value: string,
  locale: string,
  timeStyle: TimeStyle = 'short'
): string {
  const date = new Date(timestampWithZone(value));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return formatterOf(locale, timeStyle).format(date);
}
