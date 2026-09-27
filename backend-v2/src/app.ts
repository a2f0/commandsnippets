import {Hono} from 'hono';
import {cors} from 'hono/cors';
import packageJson from '../package.json';
import {authRoutes} from './auth/routes';
import {authenticate} from './auth/tokens';
import {createDb} from './db/client';
import type {AppEnv} from './env';
import {ApiError, describeError} from './lib/errors';
import {assertJsonMediaType} from './lib/jsonapi';
import {entryRoutes} from './resources/entries';
import {entryReuseRoutes} from './resources/entryReuses';
import {tagRoutes} from './resources/tags';
import {tagEntryRoutes} from './resources/tagsEntries';
import {userRoutes} from './resources/users';
import {jsonApi} from './resources/viewset';

export const API_VERSION = packageJson.version;

/** Django's CORS_ALLOWED_ORIGIN_REGEXES, anchored at both ends. */
export const ALLOWED_ORIGINS = [
  /^http:\/\/localhost(:\d+)?$/,
  /^http:\/\/127\.0\.0\.1(:\d+)?$/,
  // RFC 1918 private address space
  /^http:\/\/10\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  /^http:\/\/192\.168\.\d{1,3}\.\d{1,3}(:\d+)?$/,
  // Bundled Capacitor builds: the iOS and Android WebView origins
  // (capacitor.config.production.ts sets no server URL). Not in Django's list.
  /^capacitor:\/\/localhost$/,
  /^https:\/\/localhost$/,
  // Electron app protocols
  /^tearleads:\/\/app$/,
  /^tearleads-staging:\/\/app$/,
  /^tearleads-dev:\/\/app$/,
  // Production domains
  /^https:\/\/commandsnippets\.com$/,
  /^https:\/\/\w+\.commandsnippets\.com$/,
  // Staging domains
  /^https:\/\/\w+\.staging\.commandsnippets\.com$/,
];

export const app = new Hono<AppEnv>({strict: false});

app.use('*', async (c, next) => {
  await next();
  c.header('API-Version', API_VERSION);
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
      'x-requested-with',
    ],
    maxAge: 86_400,
  })
);

/**
 * Cross-site request forgery. A browser sends a cross-origin POST without a
 * CORS preflight only for form-like media types, so every POST must be JSON
 * (every client request already is), and any state-changing request whose
 * Origin is not one of ours is refused. Requests without an Origin (native
 * and non-browser clients) are unaffected.
 */
app.use('*', async (c, next) => {
  const {method} = c.req;
  if (method === 'POST') {
    assertJsonMediaType(c.req.raw);
  }
  const origin = c.req.header('Origin');
  if (
    !['GET', 'HEAD', 'OPTIONS'].includes(method) &&
    origin !== undefined &&
    !ALLOWED_ORIGINS.some(pattern => pattern.test(origin))
  ) {
    throw ApiError.of(403, 'Origin not allowed.', 'origin_not_allowed');
  }
  await next();
});

app.use('*', async (c, next) => {
  c.set('db', createDb(c.env.DB));
  c.set('user', await authenticate(c));
  await next();
});

app.get('/healthcheck', c => c.body(null, 200));

app.route('/', authRoutes);
app.route('/api/v1/user', userRoutes);
app.route('/api/v1/tags', tagRoutes);
app.route('/api/v1/entries', entryRoutes);
app.route('/api/v1/tags_entries', tagEntryRoutes);
app.route('/api/v1/entry_reuses', entryReuseRoutes);

app.notFound(c =>
  jsonApi(
    c,
    {errors: [{detail: 'Not found.', status: '404', code: 'not_found'}]},
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
        {detail: 'A server error occurred.', status: '500', code: 'error'},
      ],
    },
    500
  );
});
