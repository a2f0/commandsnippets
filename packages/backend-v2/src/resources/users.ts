import {Hono} from 'hono';
import type {AppEnv} from '../env';
import {USER} from './serializers';
import {jsonApi, resourceResponse} from './viewset';

export const userRoutes = new Hono<AppEnv>();

/** Introspection for the logged-in user; 401 (not 403) when anonymous. */
userRoutes.get('/', c => {
  const user = c.get('user');
  if (user === null) {
    return jsonApi(c, {errors: []}, 401);
  }
  return resourceResponse(c, USER, user);
});
