/** UTC timestamp for HTML time elements, with millisecond precision. */
export const timestampWithZone = (value: string): string => {
  const milliseconds = value.replace(/(\.\d{3})\d+/, '$1');
  return /(?:[zZ]|[+-]\d\d:\d\d)$/.test(milliseconds)
    ? milliseconds
    : `${milliseconds}Z`;
};

/**
 * Format an API timestamp for display. The API sends naive UTC
 * (`2026-09-28T11:42:49.185000`); without a zone, Date would read it as local
 * time.
 */
export function formatTimestamp(
  value: string,
  locale: string,
  timeStyle: 'short' | 'medium' = 'short'
): string {
  const date = new Date(timestampWithZone(value));
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle,
  }).format(date);
}
