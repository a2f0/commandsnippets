/**
 * The unit tests' mock API: the E2E handlers (src/msw/handlers.ts), which
 * keep state as the API's database would, with the entries of
 * test/mocks/entries/entriesResponse.ts. `__tests__/setup.ts` resets it
 * before every test; a test adds its own handlers with `server.use`.
 */
import {HttpResponse, http} from 'msw/http';
import {setupServer} from 'msw/node';
import {afterAll, afterEach, beforeAll} from 'vitest';

import {
  handlers,
  resetMSWState,
  setRuntimeEntriesOverride,
} from '../../src/msw/handlers';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';

/** Where the app sends its requests in tests (`baseHTTPURL`). */
const HOST = 'http://localhost:9001';
/** The API's root there (`baseURL`). */
const API = `${HOST}/api/v1`;

const server = setupServer(...handlers);

/** The mock API's data as every test starts with it. */
function resetMockApi(): void {
  resetMSWState();
  setRuntimeEntriesOverride(entriesResponse);
}

/**
 * Serve the mock API to a spec's tests: listening (with `options`) before the
 * first, and closed after the last. After each test, the handlers it added
 * (`server.use`) and its listeners (`server.events.on`) are removed.
 */
function serveMockApi(options?: Parameters<typeof server.listen>[0]): void {
  beforeAll(() => server.listen(options));
  afterEach(() => {
    server.resetHandlers();
    server.events.removeAllListeners();
  });
  afterAll(() => server.close());
}

/**
 * What `pick` makes of each request sent from now on (`path` is its URL's
 * pathname), in the order they are sent, leaving out those it makes
 * `undefined` of. Recording stops at the end of the test (`serveMockApi`).
 */
function recordRequests<T>(
  pick: (
    request: Request,
    path: string
  ) => T | undefined | Promise<T | undefined>
): T[] {
  const recorded: T[] = [];
  server.events.on('request:start', async ({request}) => {
    const value = await pick(request, new URL(request.url).pathname);
    if (value !== undefined) recorded.push(value);
  });
  return recorded;
}

/**
 * The API unreachable (offline) for writes until the handlers reset (the end
 * of the test, or `server.resetHandlers()`); reads still answer.
 */
function offlineForWrites(): void {
  server.use(
    http.all(`${API}/*`, ({request}) =>
      request.method === 'GET' ? undefined : HttpResponse.error()
    )
  );
}

export {
  API,
  HOST,
  offlineForWrites,
  recordRequests,
  resetMockApi,
  serveMockApi,
  server,
};
