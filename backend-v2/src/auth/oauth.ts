/** Outbound calls to the OAuth providers (Django's authentication/services.py). */
import type {Bindings} from '../env';

export type Fetcher = (input: string, init?: RequestInit) => Promise<Response>;

// Bound lazily so tests can replace globalThis.fetch.
const defaultFetch: Fetcher = (input, init) => fetch(input, init);

// GitHub's API rejects requests without a User-Agent; Python's requests sent
// one implicitly, Workers' fetch does not.
const USER_AGENT = 'tearleads-api';

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
    private readonly env: Bindings,
    private readonly fetcher: Fetcher = defaultFetch
  ) {
    this.clientId = requireSetting(env, 'GOOGLE_CLIENT_ID');
    this.clientSecret = requireSetting(env, 'GOOGLE_CLIENT_SECRET');
    this.redirectUri = requireSetting(env, 'GOOGLE_REDIRECT_URI');
  }

  accessToken(code: string): Promise<Response> {
    return this.fetcher('https://oauth2.googleapis.com/token', {
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
    return this.fetcher('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: {Authorization: `Bearer ${accessToken}`},
    });
  }

  /**
   * Whether `accessToken` was issued to one of our native apps
   * (`GOOGLE_NATIVE_CLIENT_IDS`, comma-separated). Userinfo answers for a
   * token issued to any app, so without this check any other app a user signed
   * in to with Google could replay their token here and sign in as them.
   */
  async issuedToNativeApp(accessToken: string): Promise<boolean> {
    const allowed = requireSetting(this.env, 'GOOGLE_NATIVE_CLIENT_IDS')
      .split(',')
      .map(id => id.trim())
      .filter(id => id !== '');
    // POST with the token in a header, as google-auth-library does, keeps it
    // out of URLs.
    const response = await this.fetcher(
      'https://oauth2.googleapis.com/tokeninfo',
      {method: 'POST', headers: {Authorization: `Bearer ${accessToken}`}}
    );
    if (!response.ok) {
      return false;
    }
    const {aud} = (await response.json().catch(() => ({}))) as {
      aud?: unknown;
    };
    return typeof aud === 'string' && allowed.includes(aud);
  }
}

export class GithubOAuthService {
  readonly clientId: string;
  readonly clientSecret: string;
  readonly redirectUri: string;

  constructor(
    env: Bindings,
    clientType: 'web' | 'electron' = 'web',
    private readonly fetcher: Fetcher = defaultFetch
  ) {
    const prefix = clientType === 'electron' ? 'ELECTRON_GITHUB' : 'GITHUB';
    this.clientId = requireSetting(env, `${prefix}_CLIENT_ID`);
    this.clientSecret = requireSetting(env, `${prefix}_CLIENT_SECRET`);
    this.redirectUri = requireSetting(env, `${prefix}_REDIRECT_URI`);
  }

  headers(accessToken: string): Record<string, string> {
    return {Authorization: `token ${accessToken}`, 'User-Agent': USER_AGENT};
  }

  accessToken(code: string): Promise<Response> {
    return this.fetcher('https://github.com/login/oauth/access_token', {
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
    return this.fetcher('https://api.github.com/user', {
      headers: this.headers(accessToken),
    });
  }

  emails(accessToken: string): Promise<Response> {
    return this.fetcher('https://api.github.com/user/emails', {
      headers: this.headers(accessToken),
    });
  }
}
