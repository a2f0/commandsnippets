/**
 * Constraint failures from D1. Drizzle wraps D1's error, so its message can
 * be on the error itself or on its `cause`.
 */

/** The error's message and its cause's, which the checks below read. */
function messages(error: unknown): string {
  const message = String((error as Error)?.message ?? error);
  const cause = String((error as {cause?: Error})?.cause?.message ?? '');
  return `${message} ${cause}`;
}

/** Any unique-constraint failure, e.g. a lost create race. */
export function isUniqueViolation(error: unknown): boolean {
  return /UNIQUE constraint failed/.test(messages(error));
}

/** A clash on the unique user email: the account already exists. */
export function isEmailViolation(error: unknown): boolean {
  return /UNIQUE constraint failed: users_user\.email/.test(messages(error));
}

/** A NOT NULL failure on `column` (`table.column`). */
export function isNotNullViolation(error: unknown, column: string): boolean {
  return messages(error).includes(`NOT NULL constraint failed: ${column}`);
}

/**
 * A write the data version triggers refused: of a version that is not the
 * user's active one (`0019_data_versions.sql`).
 */
export function isDataVersionChanged(error: unknown): boolean {
  return messages(error).includes('data_version_changed:');
}

/**
 * A second row of a user's data version (`users_dataversion`'s primary key):
 * a restore's guard that the active version is the one it was made over
 * (`resources/restore.ts`).
 */
export function isVersionClash(error: unknown): boolean {
  return /UNIQUE constraint failed: users_dataversion\.user_id/.test(
    messages(error)
  );
}
