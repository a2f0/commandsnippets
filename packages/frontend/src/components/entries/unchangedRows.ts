/**
 * A list's rows as the database reads them again, keeping the objects of
 * the rows it read before that are unchanged: a live query reads every row
 * afresh after any write (a reuse counted, an entry edited), and a row
 * (`React.memo`) given the same object as before does not render again.
 */

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Whether `a` and `b`, read from the database, hold the same data. It
 * allocates nothing but each object's keys: it runs on every row of every
 * read.
 */
export function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) {
    return true;
  }
  if (!isRecord(a) || !isRecord(b) || Array.isArray(a) !== Array.isArray(b)) {
    return false;
  }
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) {
    return false;
  }
  for (const key of keys) {
    if (!Object.hasOwn(b, key) || !sameData(a[key], b[key])) {
      return false;
    }
  }
  return true;
}

/**
 * `rows`, each unchanged one (by `keyOf`) replaced with its object in
 * `previous`.
 */
export function keepUnchanged<Row>(
  rows: Row[],
  previous: ReadonlyMap<string, Row>,
  keyOf: (row: Row) => string
): Row[] {
  if (previous.size === 0) {
    return rows;
  }
  return rows.map(row => {
    const before = previous.get(keyOf(row));
    return before !== undefined && sameData(before, row) ? before : row;
  });
}
