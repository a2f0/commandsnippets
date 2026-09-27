/**
 * Timestamps are naive UTC with microseconds, matching what Django stored
 * (USE_TZ = False) and what DRF rendered via `datetime.isoformat()`.
 *
 * Storage format is fixed-width (`YYYY-MM-DDTHH:MM:SS.ffffff`) so string
 * comparison is chronological. Workers freeze `Date.now()` within a request,
 * so `now()` is monotonic: rows written in the same request still get distinct,
 * increasing timestamps (Django relied on real microsecond resolution).
 */

let lastMicros = 0;

export function nowMicros(): number {
  const micros = Date.now() * 1000;
  lastMicros = micros > lastMicros ? micros : lastMicros + 1;
  return lastMicros;
}

export function formatMicros(micros: number): string {
  const seconds = new Date(Math.floor(micros / 1000))
    .toISOString()
    .slice(0, 19);
  const fraction = String(micros % 1_000_000).padStart(6, '0');
  return `${seconds}.${fraction}`;
}

export function now(): string {
  return formatMicros(nowMicros());
}

/** Render a stored timestamp the way Python's `isoformat()` does. */
export function isoformat(value: string): string;
export function isoformat(value: string | null): string | null;
export function isoformat(value: string | null): string | null {
  if (value === null) {
    return null;
  }
  return value.endsWith('.000000') ? value.slice(0, 19) : value;
}

const DATE_TIME =
  /^(\d{4}-\d{2}-\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?\s*(Z|[+-]\d{2}(?::?\d{2})?)?$/;

/**
 * Parse a client-supplied datetime (e.g. a `filter[date_updated.gt]` value)
 * into the storage format. Accepts `str(datetime)` (space separator), ISO 8601
 * with `T`, 0-9 fractional digits, and an optional UTC offset (`Z`, `+05:30`,
 * `+0530`, or Postgres's short `+00`). Returns null
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
