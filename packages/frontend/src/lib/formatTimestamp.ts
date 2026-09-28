/**
 * Format an API timestamp for display. The API sends naive UTC
 * (`2026-09-28T11:42:49.185000`); without a zone, Date would read it as local
 * time.
 */
export function formatTimestamp(value: string, locale: string): string {
  const hasZone = /(?:[zZ]|[+-]\d\d:\d\d)$/.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date);
}
