/**
 * Runs only when no static page matches (Workers serve assets first). The web
 * app used to live on this host, so any other path is an old app link, such
 * as a `/:user` or `/:user/:tag` bookmark: send it to the app, keeping the
 * path and query. Temporary (302), so browsers don't cache a redirect for a
 * path the website adds later.
 */
export interface Env {
  APP_ORIGIN: string;
  /**
   * Set on staging only: the `X-Robots-Tag` for these responses, which the
   * build's `_headers` (static assets only) does not reach.
   */
  X_ROBOTS_TAG?: string;
}

export function redirectToApp(request: Request, env: Env): Response {
  const headers = new Headers();
  if (env.X_ROBOTS_TAG) {
    headers.set('X-Robots-Tag', env.X_ROBOTS_TAG);
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    headers.set('Allow', 'GET, HEAD');
    return new Response(null, {status: 405, headers});
  }
  const {pathname, search} = new URL(request.url);
  headers.set('Location', `${env.APP_ORIGIN}${pathname}${search}`);
  return new Response(null, {status: 302, headers});
}

export default {
  fetch: redirectToApp,
};
