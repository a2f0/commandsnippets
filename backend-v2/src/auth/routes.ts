import {type Context, Hono} from 'hono';
import type {AppEnv} from '../env';
import {ApiError} from '../lib/errors';
import {parseResource} from '../lib/jsonapi';
import {charField, choiceField, validateOrThrow} from '../lib/validation';
import {getOrCreateUser, recordLogin} from '../services/users';
import {GithubOAuthService, GoogleOAuthService} from './oauth';
import {type ClientType, clearAuthCookies, setAuthCookies} from './tokens';

export const INTEGRATED_OAUTH_FIELDS = {
  provider: choiceField(['google']),
  token: charField(),
};

const unauthorized = (c: Context<AppEnv>) => c.json({errors: []}, 401);

const authenticationFailed = (detail: string) =>
  // DRF coerces AuthenticationFailed to 403 when there is no
  // WWW-Authenticate header, which was the case for this API.
  ApiError.of(403, detail, 'authentication_failed');

const noEmail = 'No email found in Google user data';
const unverifiedEmail = 'Google email is not verified';

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
}

/** Log in (or sign up) the user for a verified email and set cookies. */
async function login(
  c: Context<AppEnv>,
  username: string,
  email: string,
  clientType: ClientType = 'web'
): Promise<Response> {
  const db = c.get('db');
  const {user, created} = await getOrCreateUser(db, username, email);
  if (!created) {
    await recordLogin(db, user.id);
  }
  await setAuthCookies(c, user.id, clientType);
  return c.json({});
}

const localPart = (email: string) => email.split('@', 1)[0] as string;

// Paths are registered without trailing slashes: with `strict: false` Hono
// strips the slash from the request path, so `/api-token-deauth/` (what the
// clients call) and `/api-token-deauth` both match.
export const authRoutes = new Hono<AppEnv>({strict: false});

/**
 * Clears the cookies. The token itself is kept: there is one token per user,
 * shared across their browsers (see Django's `deauthenticate`).
 */
authRoutes.post('/api-token-deauth', c => {
  clearAuthCookies(c);
  return c.json({});
});

/** Web/Electron GitHub OAuth: exchange the code, then read login + email. */
authRoutes.post('/api/v1/github-login', async c => {
  const {attributes} = await parseResource(c.req.raw, {type: 'GithubLogin'});
  const {code, clientType} = validateOrThrow<{
    code: string;
    clientType: ClientType;
  }>(
    {code: charField(), clientType: choiceField(['web', 'electron'])},
    attributes
  );
  const service = new GithubOAuthService(c.env, clientType);

  const tokenResponse = await service.accessToken(code);
  if (!tokenResponse.ok) {
    return unauthorized(c);
  }
  const accessToken = new URLSearchParams(await tokenResponse.text()).get(
    'access_token'
  );
  if (accessToken === null) {
    return unauthorized(c);
  }
  const userResponse = await service.user(accessToken);
  if (!userResponse.ok) {
    return unauthorized(c);
  }
  const {login: username} = (await userResponse.json()) as {login: string};
  const emailsResponse = await service.emails(accessToken);
  if (!emailsResponse.ok) {
    return unauthorized(c);
  }
  const emails = (await emailsResponse.json()) as Array<{
    email: string;
    primary: boolean;
    verified?: boolean;
  }>;
  // Accounts are keyed by email, so an unverified one would let anyone who
  // adds your address to their GitHub account sign in as you.
  const primary = emails.find(
    email => email.primary === true && email.verified === true
  );
  if (primary === undefined) {
    return unauthorized(c);
  }
  return login(c, username, primary.email, clientType);
});

/** Web Google OAuth: exchange the authorization code, then read the email. */
authRoutes.post('/api/v1/google-login', async c => {
  const {attributes} = await parseResource(c.req.raw, {type: 'GoogleLogin'});
  const {code} = validateOrThrow<{code: string}>(
    {code: charField()},
    attributes
  );
  const service = new GoogleOAuthService(c.env);

  const tokenResponse = await service.accessToken(code);
  if (!tokenResponse.ok) {
    return unauthorized(c);
  }
  const {access_token: accessToken} = (await tokenResponse.json()) as {
    access_token: string;
  };
  const userResponse = await service.user(accessToken);
  if (!userResponse.ok) {
    return unauthorized(c);
  }
  const {email, email_verified} = (await userResponse.json()) as GoogleUserInfo;
  if (!email) {
    throw ApiError.of(400, noEmail, 'invalid');
  }
  // Accounts are keyed by email: only a verified one proves ownership.
  if (email_verified !== true) {
    throw authenticationFailed(unverifiedEmail);
  }
  return login(c, localPart(email), email);
});

/** Native (iOS) sign-in: the client already holds a provider access token. */
authRoutes.post('/api/v1/integrated-oauth', async c => {
  const {attributes} = await parseResource(c.req.raw, {
    type: 'IntegratedOAuthLogin',
  });
  const {token} = validateOrThrow<{provider: 'google'; token: string}>(
    INTEGRATED_OAUTH_FIELDS,
    attributes
  );
  const userResponse = await new GoogleOAuthService(c.env).user(token);
  if (!userResponse.ok) {
    throw authenticationFailed('Invalid access token provided');
  }
  const {email, email_verified} = (await userResponse.json()) as GoogleUserInfo;
  if (!email) {
    throw authenticationFailed(noEmail);
  }
  if (email_verified !== true) {
    throw authenticationFailed(unverifiedEmail);
  }
  return login(c, localPart(email), email);
});
