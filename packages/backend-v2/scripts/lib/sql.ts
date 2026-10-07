/** A SQL string literal: quoted, with its quotes doubled. */
export function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}
