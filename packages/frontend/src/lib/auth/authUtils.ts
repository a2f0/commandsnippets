let unauthorizedHandler: (username: string | null) => void = () => {};
let signedInUserOf: () => string | null = () => null;

/**
 * Set what `handleUnauthorized` does. The store module registers its reset
 * here: the API client calls `handleUnauthorized` and the store's models
 * import the API client, so importing the store from here was a cycle.
 */
export function setUnauthorizedHandler(
  handler: (username: string | null) => void
): void {
  unauthorizedHandler = handler;
}

/**
 * Set where the signed-in user is read (the app state registers it), for
 * requests to say who sent them: the API client names the user in its writes,
 * and an answer that the session is gone signs out only that user.
 */
export function setSignedInUser(user: () => string | null): void {
  signedInUserOf = user;
}

/** The signed-in user, as a request is sent (null: none). */
export const signedInUser = (): string | null => signedInUserOf();

/**
 * The API says the session a request was sent in, as `username`, is gone:
 * sign them out of the app (unless it has left that session since).
 */
export function handleUnauthorized(username: string | null) {
  console.info('Unauthorized access detected, resetting application state');
  unauthorizedHandler(username);
}

/**
 * The client-readable login cookie names for an environment. Staging and
 * production share `.commandsnippets.com`, so staging has its own name
 * (backend-v2's COOKIE_NAME_PREFIX) and must never read production's
 * `LoggedIn`, which would show a signed-in UI with no staging session.
 */
export function loggedInCookieNames(environment: string): string[] {
  return environment === 'staging' ? ['StagingLoggedIn'] : ['LoggedIn'];
}

/**
 * Whether any of the environment's login cookies is set. This only drives UI
 * state; the httpOnly auth cookie is what the API checks.
 */
export function hasLoginCookie(
  cookies: Record<string, unknown>,
  environment: string
): boolean {
  return loggedInCookieNames(environment).some(name => Boolean(cookies[name]));
}
