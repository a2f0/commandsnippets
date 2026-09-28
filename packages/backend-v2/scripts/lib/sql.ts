/** A SQL literal: NULL, a number, or a quoted string with its quotes doubled. */
export function sqlLiteral(value: string | number | null): string {
  if (value === null) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  return `'${value.replaceAll("'", "''")}'`;
}
