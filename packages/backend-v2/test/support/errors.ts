/** Reading database errors in tests: Drizzle wraps D1's error as `cause`. */

/** Every message along an error's `cause` chain, joined. */
export function errorMessages(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  while (current instanceof Error) {
    parts.push(current.message);
    current = current.cause;
  }
  return parts.join(' | ');
}

/** The messages of a query that must fail (see `errorMessages`). */
export async function failureOf(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return errorMessages(error);
  }
  throw new Error('Expected the query to fail');
}
