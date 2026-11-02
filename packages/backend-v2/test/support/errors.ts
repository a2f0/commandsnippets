/**
 * Reading errors in tests: the API's (`ApiError`), and the database's, which
 * Drizzle wraps as `cause`.
 */
import {ApiError} from '../../src/lib/errors';

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

/** The API error `run` throws, or whose promise it rejects with. */
export async function apiErrorOf(run: () => unknown): Promise<ApiError> {
  try {
    await run();
  } catch (error) {
    if (error instanceof ApiError) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected an API error');
}
