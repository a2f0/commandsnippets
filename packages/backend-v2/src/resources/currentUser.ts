import {Hono} from 'hono';
import type {AppEnv} from '../env';
import {USER} from './resourceTypes';
import {jsonApi} from './responses';
import {resourceResponse} from './viewset';

/** `GET /api/v1/user`: the requesting user's own `User` resource. */
export const currentUserRoutes = new Hono<AppEnv>();

/**
 * Introspection for the logged-in user; 401 (not 403) when anonymous, as a
 * JSON:API document (the OAuth routes' 401s are plain JSON).
 */
currentUserRoutes.get('/', c => {
  const user = c.get('user');
  if (user === null) {
    return jsonApi(c, {errors: []}, 401);
  }
  return resourceResponse(c, USER, user);
});
