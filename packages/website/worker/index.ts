/**
 * Runs only when no static page matches (Workers serve assets first). The web
 * app used to live on this host, so any other path is an old app link, such
 * as a `/:user` or `/:user/:tag` bookmark: send it to the app, keeping the
 * path and query. Temporary (302), so browsers don't cache a redirect for a
 * path the website adds later.
 */
export interface Env {
  APP_ORIGIN: string;
}

export function redirectToApp(request: Request, env: Env): Response {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(null, {status: 405, headers: {Allow: 'GET, HEAD'}});
  }
  const {pathname, search} = new URL(request.url);
  return Response.redirect(`${env.APP_ORIGIN}${pathname}${search}`, 302);
}

export default {
  fetch: redirectToApp,
};
