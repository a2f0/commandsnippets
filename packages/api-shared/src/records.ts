/**
 * Reading untrusted objects (request documents, issue params, lookups by
 * name). Internal: the entry points do not re-export it.
 */

/** A plain object: not null, not an array. */
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * An own property only: `constructor` is no one's filter, sort field or
 * relationship.
 */
export function own<T>(
  record: Readonly<Record<string, T>>,
  key: string
): T | undefined {
  return Object.hasOwn(record, key) ? record[key] : undefined;
}
