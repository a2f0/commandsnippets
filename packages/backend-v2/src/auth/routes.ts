import {loginAttributesSchema} from '@commandsnippets/api-shared';
import {type Context, Hono} from 'hono';
import * as z from 'zod/mini';
import type {AppEnv} from '../env';
import {authenticationFailed, validationError} from '../lib/errors';
import {parseResource} from '../lib/jsonapi/request';
import {validateFields} from '../lib/validate';
import {GITHUB_LOGIN, GOOGLE_LOGIN} from '../resources/resourceTypes';
import {getOrCreateUser, recordLogin} from '../services/users';
import {clearAuthCookies, setAuthCookies} from './cookies';
import {GithubOAuthService, GoogleOAuthService} from './oauth';

const unauthorized = (c: Context<AppEnv>) => c.json({errors: []}, 401);

const noEmail = 'No email found in Google user data';
const unverifiedEmail = 'Google email is not verified';

/** GitHub's user (`GET /user`): its login is the account's username. */
const githubUserSchema = z.object({login: z.string().check(z.minLength(1))});

/** GitHub's emails (`GET /user/emails`). */
const githubEmailsSchema = z.array(
  z.object({
    email: z.string(),
    primary: z.boolean(),
    verified: z.optional(z.boolean()),
  })
);

/**
 * A provider's JSON answer as `schema` reads it, or undefined when it is
 * not one: an error status, not JSON, or not of that shape.
 */
async function payload<S extends z.ZodMiniType>(
  response: Response,
  schema: S
): Promise<z.output<S> | undefined> {
  if (!response.ok) {
    return undefined;
  }
  const body: unknown = await response.json().catch(() => undefined);
  const result = schema.safeParse(body);
  return result.success ? result.data : undefined;
}

/** Google's token answer (`POST /token`). */
const googleTokenSchema = z.object({
  access_token: z.string().check(z.minLength(1)),
});

/**
 * Google's userinfo. Its email may be missing (a 400) and only
 * `email_verified: true` proves it, so both are read as they come.
 */
const googleUserSchema = z.object({
  email: z.optional(z.string()),
  email_verified: z.optional(z.unknown()),
});

/**
 * Log in (or sign up) the user for a verified email and set cookies. A
 * deactivated account is refused before anything is recorded or issued.
 */
async function login(
  c: Context<AppEnv>,
  username: string,
  email: string
): Promise<Response> {
  const db = c.get('db');
  const {user, created} = await getOrCreateUser(db, username, email);
  if (!user.is_active) {
    throw authenticationFailed('This account has been deactivated.');
  }
  if (!created) {
    await recordLogin(db, user.id);
  }
  await setAuthCookies(c, user.id);
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

/** GitHub OAuth: exchange the code, then read login + email. */
authRoutes.post('/api/v1/github-login', async c => {
  const {attributes} = await parseResource(c.req.raw, {type: GITHUB_LOGIN});
  const {code} = validateFields(loginAttributesSchema, attributes);
  const service = new GithubOAuthService(c.env);

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
  const [user, emails] = await Promise.all([
    service.user(accessToken).then(r => payload(r, githubUserSchema)),
    service.emails(accessToken).then(r => payload(r, githubEmailsSchema)),
  ]);
  if (user === undefined || emails === undefined) {
    return unauthorized(c);
  }
  // Accounts are keyed by email, so an unverified one would let anyone who
  // adds your address to their GitHub account sign in as you.
  const primary = emails.find(
    email => email.primary === true && email.verified === true
  );
  if (primary === undefined) {
    return unauthorized(c);
  }
  return login(c, user.login, primary.email);
});

/** Web Google OAuth: exchange the authorization code, then read the email. */
authRoutes.post('/api/v1/google-login', async c => {
  const {attributes} = await parseResource(c.req.raw, {type: GOOGLE_LOGIN});
  const {code} = validateFields(loginAttributesSchema, attributes);
  const service = new GoogleOAuthService(c.env);

  const token = await payload(
    await service.accessToken(code),
    googleTokenSchema
  );
  if (token === undefined) {
    return unauthorized(c);
  }
  const userInfo = await payload(
    await service.user(token.access_token),
    googleUserSchema
  );
  if (userInfo === undefined) {
    return unauthorized(c);
  }
  const {email, email_verified} = userInfo;
  if (!email) {
    throw validationError(noEmail);
  }
  // Accounts are keyed by email: only a verified one proves ownership.
  if (email_verified !== true) {
    throw authenticationFailed(unverifiedEmail);
  }
  return login(c, localPart(email), email);
});
