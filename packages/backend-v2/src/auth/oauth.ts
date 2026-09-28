/** Outbound calls to the OAuth providers (Django's authentication/services.py). */
import type {Bindings} from '../env';

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

// Bound lazily so tests can replace globalThis.fetch.
const defaultFetch: Fetcher = (input, init) => fetch(input, init);

// GitHub's API rejects requests without a User-Agent; Python's requests sent
// one implicitly, Workers' fetch does not.
const USER_AGENT = 'commandsnippets-api';

export const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
export const GOOGLE_USERINFO_URL =
  'https://www.googleapis.com/oauth2/v3/userinfo';
export const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token';
export const GITHUB_USER_URL = 'https://api.github.com/user';
export const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails';

function requireSetting(env: Bindings, name: keyof Bindings): string {
  const value = env[name];
  if (typeof value !== 'string' || value === '') {
    throw new Error(`ImproperlyConfigured: ${name} must be set`);
  }
  return value;
}

export class GoogleOAuthService {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;

  constructor(
    env: Bindings,
    private readonly fetcher: Fetcher = defaultFetch
  ) {
    this.clientId = requireSetting(env, 'GOOGLE_CLIENT_ID');
    this.clientSecret = requireSetting(env, 'GOOGLE_CLIENT_SECRET');
    this.redirectUri = requireSetting(env, 'GOOGLE_REDIRECT_URI');
  }

  accessToken(code: string): Promise<Response> {
    return this.fetcher(GOOGLE_TOKEN_URL, {
      method: 'POST',
      body: new URLSearchParams({
        client_id: this.clientId,
        code,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
        grant_type: 'authorization_code',
      }),
    });
  }

  user(accessToken: string): Promise<Response> {
    return this.fetcher(GOOGLE_USERINFO_URL, {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
  }
}

export class GithubOAuthService {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;

  constructor(
    env: Bindings,
    private readonly fetcher: Fetcher = defaultFetch
  ) {
    this.clientId = requireSetting(env, 'GITHUB_CLIENT_ID');
    this.clientSecret = requireSetting(env, 'GITHUB_CLIENT_SECRET');
    this.redirectUri = requireSetting(env, 'GITHUB_REDIRECT_URI');
  }

  headers(accessToken: string): Record<string, string> {
    return {Authorization: `token ${accessToken}`, 'User-Agent': USER_AGENT};
  }

  accessToken(code: string): Promise<Response> {
    return this.fetcher(GITHUB_TOKEN_URL, {
      method: 'POST',
      headers: {'User-Agent': USER_AGENT},
      body: new URLSearchParams({
        client_id: this.clientId,
        code,
        client_secret: this.clientSecret,
        redirect_uri: this.redirectUri,
      }),
    });
  }

  user(accessToken: string): Promise<Response> {
    return this.fetcher(GITHUB_USER_URL, {
      headers: this.headers(accessToken),
    });
  }

  emails(accessToken: string): Promise<Response> {
    return this.fetcher(GITHUB_EMAILS_URL, {
      headers: this.headers(accessToken),
    });
  }
}
