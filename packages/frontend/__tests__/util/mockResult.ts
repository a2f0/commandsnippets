import invariant from 'invariant';
import type {MockResult} from 'vitest';

/** Await the actual observed operation, not just a dependency it waits on. */
export function mockResult<T>(
  mock: {mock: {results: readonly MockResult<T>[]}},
  index = 0
): T {
  const result = mock.mock.results[index];
  invariant(result?.type === 'return', `Observed call ${index} returned`);
  return result.value;
}
