import {describe, expect, it} from 'vitest';

import {
  hasLoginCookie,
  loggedInCookieNames,
} from '../../../../src/lib/auth/authUtils';

describe('loggedInCookieNames', () => {
  it('uses only the staging name on staging', () => {
    expect(loggedInCookieNames('staging')).toEqual(['StagingLoggedIn']);
  });

  it.each(['production', 'development', 'test'])(
    'keeps the original name for %s',
    environment => {
      expect(loggedInCookieNames(environment)).toEqual(['LoggedIn']);
    }
  );
});

// Staging and production share `.commandsnippets.com`, so each sees the
// other's cookies and must read only its own.
describe('hasLoginCookie on the shared domain', () => {
  it("sees staging's own login", () => {
    expect(hasLoginCookie({StagingLoggedIn: 'true'}, 'staging')).toBe(true);
  });

  it("ignores production's login on staging", () => {
    expect(hasLoginCookie({LoggedIn: 'true'}, 'staging')).toBe(false);
  });

  it('treats no login cookie as logged out', () => {
    expect(hasLoginCookie({}, 'staging')).toBe(false);
    expect(hasLoginCookie({StagingLoggedIn: ''}, 'staging')).toBe(false);
  });

  it("ignores staging's login in production", () => {
    expect(hasLoginCookie({StagingLoggedIn: 'true'}, 'production')).toBe(false);
    expect(hasLoginCookie({LoggedIn: 'true'}, 'production')).toBe(true);
  });
});
