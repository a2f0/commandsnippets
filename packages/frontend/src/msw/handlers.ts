import {HttpResponse, http} from 'msw/http';

import {apiHosts, refuseAnotherUsersRequest, route} from './route';
import {accountRoutes} from './routes/account';
import {adminRoutes} from './routes/admin';
import {entryRoutes} from './routes/entries';
import {junctionRoutes} from './routes/junctions';
import {publicRoutes} from './routes/public';
import {reuseRoutes} from './routes/reuses';
import {tagRoutes} from './routes/tags';
import {refuseAnotherVersion} from './versions';

// The responses follow the API contract (api-shared's document schemas);
// __tests__/src/msw/contract.spec.ts checks every one of them.

/**
 * The mock API's handlers, in the order MSW tries them: for each host, the
 * guards first (another user's request, another data version's), then each
 * resource's routes (`routes/`). Their state is `state.ts`.
 */
const createHandlers = () => {
  const handlers = [];

  for (const host of apiHosts) {
    const baseUrl = `${host}/api/v1`;
    handlers.push(
      http.all(
        `${baseUrl}/*`,
        ({request}) =>
          refuseAnotherUsersRequest(request) ?? refuseAnotherVersion(request)
      ),
      ...accountRoutes(baseUrl),
      ...publicRoutes(baseUrl),
      ...adminRoutes(baseUrl),

      // Health check endpoint
      route('GET', `${baseUrl}/health`, () => {
        console.log('OK: MSW intercepted health check request');
        return HttpResponse.json(
          {status: 'ok'},
          {
            status: 200,
          }
        );
      }),
      ...tagRoutes(baseUrl),
      ...entryRoutes(baseUrl),
      ...reuseRoutes(baseUrl),
      ...junctionRoutes(baseUrl)
    );
  }

  // Auth endpoint (different pattern): the API answers `{}`
  for (const host of apiHosts) {
    handlers.push(
      route(
        'POST',
        `${host}/api-token-deauth/`,
        ({request}) =>
          refuseAnotherUsersRequest(request) ??
          HttpResponse.json({}, {status: 200})
      )
    );
  }

  return handlers;
};

export const handlers = createHandlers();

export {resetMSWState, setRuntimeEntriesOverride} from './state';
