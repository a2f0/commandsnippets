import {describe, expect, it} from 'vitest';

import {loggedInCookieName} from '../../../../src/lib/auth/authUtils';

describe('loggedInCookieName', () => {
  it('uses the staging-specific name on staging', () => {
    expect(loggedInCookieName('staging')).toBe('StagingLoggedIn');
  });

  it.each(['production', 'development', 'test'])(
    'keeps the original name for %s',
    environment => {
      expect(loggedInCookieName(environment)).toBe('LoggedIn');
    }
  );
});
