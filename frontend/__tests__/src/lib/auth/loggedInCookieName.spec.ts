import {describe, expect, it} from 'vitest';

import {
  hasLoginCookie,
  loggedInCookieNames,
} from '../../../../src/lib/auth/authUtils';

describe('loggedInCookieNames', () => {
  it('prefers the staging name on staging, accepting the legacy one', () => {
    expect(loggedInCookieNames('staging')).toEqual([
      'StagingLoggedIn',
      'LoggedIn',
    ]);
  });

  it.each(['production', 'development', 'test'])(
    'keeps the original name for %s',
    environment => {
      expect(loggedInCookieNames(environment)).toEqual(['LoggedIn']);
    }
  );
});

// Staging's frontend and API may switch cookie names in either order.
describe('hasLoginCookie across the staging switchover', () => {
  it('sees a login from the Django API (LoggedIn) before cutover', () => {
    expect(hasLoginCookie({LoggedIn: 'true'}, 'staging')).toBe(true);
  });

  it('sees a login from backend-v2 (StagingLoggedIn) after cutover', () => {
    expect(hasLoginCookie({StagingLoggedIn: 'true'}, 'staging')).toBe(true);
  });

  it('treats no login cookie as logged out', () => {
    expect(hasLoginCookie({}, 'staging')).toBe(false);
    expect(hasLoginCookie({LoggedIn: ''}, 'staging')).toBe(false);
  });

  it('ignores the staging name outside staging', () => {
    expect(hasLoginCookie({StagingLoggedIn: 'true'}, 'production')).toBe(false);
    expect(hasLoginCookie({LoggedIn: 'true'}, 'production')).toBe(true);
  });
});
