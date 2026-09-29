/**
 * The unit tests' mock API: the E2E handlers (src/msw/handlers.ts), which
 * keep state as the API's database would, with the entries of
 * test/mocks/entries/entriesResponse.ts. `__tests__/setup.ts` resets it
 * before every test; a test adds its own handlers with `server.use`.
 */
import {setupServer} from 'msw/node';

import {
  handlers,
  resetMSWState,
  setRuntimeEntriesOverride,
} from '../../src/msw/handlers';
import {entriesResponse} from '../../test/mocks/entries/entriesResponse';

const server = setupServer(...handlers);

/** The mock API's data as every test starts with it. */
function resetMockApi(): void {
  resetMSWState();
  setRuntimeEntriesOverride(entriesResponse);
}

export {resetMockApi, server};
