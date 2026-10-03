import {
  API_VERSION_HEADER,
  CLIENT_UPDATED_HEADER,
  CLIENT_WRITE_ID_HEADER,
  CODES,
  DATA_ACCESS_HEADER,
  DATA_OWNER_ID_HEADER,
  EXPECTED_USER_HEADER,
  EXPECTED_USER_ID_HEADER,
  PUBLIC_REVISION_HEADER,
} from '@commandsnippets/api-shared';
import {Hono} from 'hono';
import {cors} from 'hono/cors';
import packageJson from '../package.json';
import {authenticate} from './auth/authentication';
import {authRoutes} from './auth/routes';
import {createDb} from './db/client';
import type {AppEnv} from './env';
import {
  ApiError,
  describeError,
  originNotAllowed,
  userMismatch,
} from './lib/errors';
import {assertJsonMediaType} from './lib/jsonapi';
import {adminRoutes} from './resources/admin';
import {currentUserRoutes} from './resources/currentUser';
import {entryRoutes} from './resources/entries';
import {entryReuseRoutes} from './resources/entryReuses';
import {jsonApi} from './resources/responses';
import {tagRoutes} from './resources/tags';
import {tagEntryRoutes} from './resources/tagsEntries';
import {userDataRoutes} from './resources/userData';

const API_VERSION = packageJson.version;

/** Django's CORS_ALLOWED_ORIGIN_REGEXES, anchored at both ends. */
const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  // RFC 1918 private address space
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  // The apex (website) and first-level subdomains: app, app-staging,
  // website-staging. Staging names are hyphenated because Universal SSL covers
  // only one level below the apex.
  /^https:\/\/commandsnippets\.com$/,
  /^https:\/\/[a-z0-9]+(?:-[a-z0-9]+)*\.commandsnippets\.com$/,
];

/** The methods that change nothing. */
const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

export const app = new Hono<AppEnv>({strict: false});

// Every response names the API's version, errors and preflights included.
app.use('*', async (c, next) => {
  await next();
  c.header(API_VERSION_HEADER, API_VERSION);
});

app.use(
  '*',
  cors({
    origin: origin =>
      ALLOWED_ORIGINS.some(pattern => pattern.test(origin)) ? origin : null,
    credentials: true,
    allowMethods: ['DELETE', 'GET', 'OPTIONS', 'PATCH', 'POST', 'PUT'],
    allowHeaders: [
      'accept',
      'authorization',
      'content-type',
      'user-agent',
      'x-csrftoken',
      EXPECTED_USER_HEADER.toLowerCase(),
      EXPECTED_USER_ID_HEADER.toLowerCase(),
      CLIENT_UPDATED_HEADER.toLowerCase(),
      CLIENT_WRITE_ID_HEADER.toLowerCase(),
      DATA_ACCESS_HEADER.toLowerCase(),
      DATA_OWNER_ID_HEADER.toLowerCase(),
      PUBLIC_REVISION_HEADER.toLowerCase(),
      'x-requested-with',
    ],
    // For the web app, on another origin, to read which API version answered.
    exposeHeaders: [API_VERSION_HEADER],
    maxAge: 86_400,
  })
);

/**
 * Cross-site request forgery. A browser sends a cross-origin POST without a
 * CORS preflight only for form-like media types, so every POST must be JSON
 * (every client request already is), and any state-changing request whose
 * Origin is not one of ours is refused. Requests without an Origin
 * (non-browser clients) are unaffected.
 */
app.use('*', async (c, next) => {
  const {method} = c.req;
  if (method === 'POST') {
    assertJsonMediaType(c.req.raw);
  }
  const origin = c.req.header('Origin');
  if (
    !SAFE_METHODS.includes(method) &&
    origin !== undefined &&
    !ALLOWED_ORIGINS.some(pattern => pattern.test(origin))
  ) {
    throw originNotAllowed();
  }
  await next();
});

/** A URI-encoded username, or null when it is not validly encoded. */
function decodedUsername(encoded: string): string | null {
  try {
    return decodeURIComponent(encoded);
  } catch {
    return null;
  }
}

app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB));
  c.set('user', await authenticate(c));
  await next();
});

/**
 * A request that names the user it acts for (`EXPECTED_USER_HEADER`, or
 * their id: `EXPECTED_USER_ID_HEADER`) is refused when signed in as anyone
 * else (409 `user_mismatch`): a browser tab
 * whose session another tab replaced can neither write into the new user's
 * account nor read the new user's data as its own user's. Checked with the
 * request's own session, so no switch can come between the check and the
 * request. Anonymous requests are left to the routes (403
 * `not_authenticated`), and requests that name no user are unaffected.
 */
app.use('*', async (c, next) => {
  const expected = c.req.header(EXPECTED_USER_HEADER);
  const expectedId = c.req.header(EXPECTED_USER_ID_HEADER);
  const user = c.get('user');
  if (
    user !== null &&
    ((expected !== undefined && decodedUsername(expected) !== user.username) ||
      (expectedId !== undefined && expectedId !== String(user.id)))
  ) {
    throw userMismatch();
  }
  await next();
});

app.get('/healthcheck', c => c.body(null, 200));

app.route('/', authRoutes);
app.route('/api/v1/user', currentUserRoutes);
app.route('/api/v1/tags', tagRoutes);
app.route('/api/v1/entries', entryRoutes);
app.route('/api/v1/tags_entries', tagEntryRoutes);
app.route('/api/v1/entry_reuses', entryReuseRoutes);
app.route('/api/v1/admin', adminRoutes);
app.route('/api/v1/users', userDataRoutes);

app.notFound(c =>
  jsonApi(
    c,
    {
      errors: [{detail: 'Not found.', status: '404', code: CODES.notFound}],
    },
    404
  )
);

app.onError((error, c) => {
  if (error instanceof ApiError) {
    return jsonApi(c, {errors: error.errors}, error.status as 400);
  }
  console.error(describeError(error));
  return jsonApi(
    c,
    {
      errors: [
        {
          detail: 'A server error occurred.',
          status: '500',
          code: CODES.serverError,
        },
      ],
    },
    500
  );
});
