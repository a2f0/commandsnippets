import {describe, expect, it} from 'vitest';
import {refreshUser, userFactory} from '../helpers';
import {
  GITHUB_EMAILS_URL,
  GOOGLE_TOKEN_URL,
  GOOGLE_USERINFO_URL,
  githubPayload,
  githubRoutes,
  googlePayload,
  mockFetch,
  requestWithEnv,
  setCookies,
} from '../support/auth';

// Accounts are looked up by email, so only a provider-verified address may
// sign in. Otherwise anyone who attaches your address to their GitHub or
// Google account (without verifying it) would get your account.
describe('OAuth email verification', () => {
  it("rejects GitHub logins whose primary email isn't verified", async () => {
    const victim = await userFactory({email: 'victim@example.com'});
    for (const emails of [
      [{email: 'victim@example.com', primary: true, verified: false}],
      [{email: 'victim@example.com', primary: true}],
      // A verified address that is not the primary one does not count either.
      [
        {email: 'victim@example.com', primary: true, verified: false},
        {email: 'other@example.com', primary: false, verified: true},
      ],
    ]) {
      mockFetch(
        githubRoutes('attacker', 'victim@example.com').map(route =>
          route.url === GITHUB_EMAILS_URL ? {...route, body: emails} : route
        )
      );
      const response = await requestWithEnv(
        {},
        'POST',
        '/api/v1/github-login/',
        githubPayload()
      );
      expect(response.status).toBe(401);
      expect(setCookies(response)).toEqual({});
    }
    expect((await refreshUser(victim.id))?.login_count).toBe(1);
  });

  it("rejects Google web logins whose email isn't verified", async () => {
    const victim = await userFactory({email: 'victim@example.com'});
    for (const userinfo of [
      {email: 'victim@example.com', email_verified: false},
      {email: 'victim@example.com'},
    ]) {
      mockFetch([
        {method: 'POST', url: GOOGLE_TOKEN_URL, body: {access_token: 'token'}},
        {method: 'GET', url: GOOGLE_USERINFO_URL, body: userinfo},
      ]);
      const response = await requestWithEnv(
        {},
        'POST',
        '/api/v1/google-login/',
        googlePayload()
      );
      expect(response.status).toBe(403);
      expect(
        ((await response.json()) as {errors: {detail: string}[]}).errors[0]
          ?.detail
      ).toBe('Google email is not verified');
      expect(setCookies(response)).toEqual({});
    }
    expect((await refreshUser(victim.id))?.login_count).toBe(1);
  });
});
