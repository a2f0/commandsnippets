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
