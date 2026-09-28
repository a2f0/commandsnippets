/**
 * Timestamps on the wire. The API renders them as naive UTC in Python's
 * `isoformat()` style, with microseconds unless they are zero
 * (`2024-01-01T12:34:56.123456`, `2024-01-01T12:34:56`; see
 * `timestampSchema`), and accepts a wider set of forms in filters
 * (`parseDateTime`).
 *
 * This module imports nothing, and is exported on its own as
 * `@commandsnippets/api-shared/datetime`: the backend's Bun scripts load it
 * outside a bundler, where api-shared's imports (zod) would not resolve.
 */

/** Microseconds since the epoch as the fixed-width stored form. */
export function formatMicros(micros: number): string {
  const seconds = new Date(Math.floor(micros / 1000))
    .toISOString()
    .slice(0, 19);
  const fraction = String(micros % 1_000_000).padStart(6, '0');
  return `${seconds}.${fraction}`;
}

const DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Parse a client-supplied datetime (e.g. a `filter[date_updated.gt]` value)
 * into the fixed-width naive-UTC form (`YYYY-MM-DDTHH:MM:SS.ffffff`), which
 * compares chronologically as a string. Accepts `str(datetime)` (space
 * separator), ISO 8601 with `T`, 0-9 fractional digits, and an optional UTC
 * offset (`Z`, `+05:30`, `+0530`, or Postgres's short `+00`). Returns null
 * when the value is not a valid date/time.
 */
export function parseDateTime(value: string): string | null {
  const match = DATE_TIME.exec(value.trim());
  if (!match) {
    return null;
  }
  const [, date, hh = '00', mm = '00', ss = '00', fraction = '', offset] =
    match;
  const micros = Number(fraction.padEnd(6, '0').slice(0, 6));
  const base = Date.parse(`${date}T${hh}:${mm}:${ss}Z`);
  if (Number.isNaN(base)) {
    return null;
  }
  let offsetMinutes = 0;
  if (offset !== undefined && offset !== 'Z') {
    const sign = offset.startsWith('-') ? -1 : 1;
    const digits = offset.slice(1).replace(':', '');
    offsetMinutes =
      sign * (Number(digits.slice(0, 2)) * 60 + Number(digits.slice(2) || 0));
  }
  return formatMicros((base - offsetMinutes * 60_000) * 1000 + micros);
}
