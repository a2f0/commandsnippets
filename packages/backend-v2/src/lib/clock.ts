/**
 * Timestamps are naive UTC with microseconds, matching what Django stored
 * (USE_TZ = False) and what DRF rendered via `datetime.isoformat()`.
 *
 * Storage format is fixed-width (`YYYY-MM-DDTHH:MM:SS.ffffff`) so string
 * comparison is chronological. Workers freeze `Date.now()` within a request,
 * so `now()` is monotonic: rows written in the same request still get distinct,
 * increasing timestamps (Django relied on real microsecond resolution).
 *
 * The format, and the parsing of client-supplied datetimes into it
 * (`parseDateTime`), are part of the API contract in api-shared. Its
 * dependency-free `datetime` entry point keeps this module loadable by the
 * Bun scripts, outside the bundler.
 */
import {formatMicros} from '@commandsnippets/api-shared/datetime';

export {
  formatMicros,
  parseDateTime,
} from '@commandsnippets/api-shared/datetime';

let lastMicros = 0;

export function nowMicros(): number {
  const micros = Date.now() * 1000;
  lastMicros = micros > lastMicros ? micros : lastMicros + 1;
  return lastMicros;
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
