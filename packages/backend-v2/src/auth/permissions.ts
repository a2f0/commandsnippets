/** DRF permission classes, checked by handlers against the request's user. */
import type {Context} from 'hono';
import type {User} from '../db/schema';
import type {AppEnv} from '../env';
import {notAuthenticated, permissionDenied} from '../lib/errors';

/** DRF's IsAuthenticated: anonymous requests get a 403. */
export function requireUser(c: Context<AppEnv>): User {
  const user = c.get('user');
  if (user === null) {
    throw notAuthenticated();
  }
  return user;
}

/** DRF's IsAdminUser: `is_staff` users only; everyone else gets a 403. */
export function requireStaff(c: Context<AppEnv>): User {
  const user = requireUser(c);
  if (!user.is_staff) {
    throw permissionDenied();
  }
  return user;
}
