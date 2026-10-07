/**
 * Constraint failures from D1. Drizzle wraps D1's error, so its message can
 * be on the error itself or on its `cause`.
 */

/** Any unique-constraint failure, e.g. a lost create race. */
export function isUniqueViolation(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  const cause = String((error as {cause?: Error})?.cause?.message ?? '');
  return /UNIQUE constraint failed/.test(message + cause);
}

/** A clash on the unique user email: the account already exists. */
export function isEmailViolation(error: unknown): boolean {
  const message = `${(error as Error)?.message ?? ''} ${
    (error as {cause?: Error})?.cause?.message ?? ''
  }`;
  return /UNIQUE constraint failed: users_user\.email/.test(message);
}

/** A NOT NULL failure on `column` (`table.column`). */
export function isNotNullViolation(error: unknown, column: string): boolean {
  const message = String((error as Error)?.message ?? error);
  const cause = String((error as {cause?: Error})?.cause?.message ?? '');
  return (message + cause).includes(`NOT NULL constraint failed: ${column}`);
}

/**
 * A write the data version triggers refused: of a version that is not the
 * user's active one (`0019_data_versions.sql`).
 */
export function isDataVersionChanged(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  const cause = String((error as {cause?: Error})?.cause?.message ?? '');
  return (message + cause).includes('data_version_changed:');
}

/**
 * A second row of a user's data version (`users_dataversion`'s primary key):
 * a restore's guard that the active version is the one it was made over
 * (`resources/restore.ts`).
 */
export function isVersionClash(error: unknown): boolean {
  const message = String((error as Error)?.message ?? error);
  const cause = String((error as {cause?: Error})?.cause?.message ?? '');
  return /UNIQUE constraint failed: users_dataversion\.user_id/.test(
    message + cause
  );
}
