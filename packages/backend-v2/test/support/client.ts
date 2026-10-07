/** A small DRF-style APIClient with a cookie jar, calling the app in-process. */

import {env} from 'cloudflare:workers';
import {DATA_VERSION_HEADER} from '@commandsnippets/api-shared';
import {app} from '../../src/app';

/** The methods that only read: their requests name no data version. */
const READS = ['GET', 'HEAD', 'OPTIONS'];

/** One request to the app exactly as given: no default headers or cookies. */
export async function appRequest(
  path: string,
  init: RequestInit = {},
  bindings: Cloudflare.Env = env
): Promise<Response> {
  return app.request(`http://localhost${path}`, init, bindings);
}

/** A Set-Cookie header: name, raw value, and attributes by lower-case name. */
export interface SetCookie {
  name: string;
  value: string;
  attributes: Record<string, string | true>;
}

export function parseSetCookie(header: string): SetCookie {
  const [pair = '', ...parts] = header.split(';').map(part => part.trim());
  const separator = pair.indexOf('=');
  const attributes: Record<string, string | true> = {};
  for (const part of parts) {
    const index = part.indexOf('=');
    if (index === -1) {
      attributes[part.toLowerCase()] = true;
    } else {
      attributes[part.slice(0, index).toLowerCase()] = part.slice(index + 1);
    }
  }
  return {
    name: pair.slice(0, separator),
    value: pair.slice(separator + 1),
    attributes,
  };
}

/** Every Set-Cookie header of a response, in order, repeated names included. */
export function setCookieHeaders(response: Response): SetCookie[] {
  return response.headers.getSetCookie().map(parseSetCookie);
}

interface Cookie {
  value: string;
  attributes: Record<string, string | true>;
}

export class ApiClient {
  readonly cookies = new Map<string, Cookie>();
  /**
   * The data version its writes name (`X-Data-Version`), as the app's name
   * the one their copy of the data is of: an account's first, until a test
   * moves it on (after a restore, say) or names none (`undefined`).
   */
  dataVersion: number | undefined = 1;

  constructor(
    token?: string,
    private readonly bindings: Cloudflare.Env = env
  ) {
    if (token !== undefined) {
      this.cookies.set('Authorization', {value: token, attributes: {}});
    }
  }

  async request(
    method: string,
    path: string,
    body?: unknown,
    headers: Record<string, string> = {}
  ): Promise<Response> {
    const cookie = [...this.cookies]
      .filter(([, {value}]) => value !== '')
      .map(([name, {value}]) => `${name}=${value}`)
      .join('; ');
    const response = await appRequest(
      path,
      {
        method,
        headers: {
          'Content-Type': 'application/vnd.api+json',
          ...(cookie === '' ? {} : {Cookie: cookie}),
          ...(this.dataVersion === undefined || READS.includes(method)
            ? {}
            : {[DATA_VERSION_HEADER]: String(this.dataVersion)}),
          ...headers,
        },
        ...(body === undefined ? {} : {body: JSON.stringify(body)}),
      },
      this.bindings
    );
    for (const {name, value, attributes} of setCookieHeaders(response)) {
      this.cookies.set(name, {value: decodeURIComponent(value), attributes});
    }
    return response;
  }

  get(path: string, headers?: Record<string, string>) {
    return this.request('GET', path, undefined, headers);
  }
  post(path: string, body?: unknown) {
    return this.request('POST', path, body ?? {});
  }
  patch(path: string, body: unknown) {
    return this.request('PATCH', path, body);
  }
  put(path: string, body: unknown) {
    return this.request('PUT', path, body);
  }
  delete(path: string) {
    return this.request('DELETE', path);
  }
  options(path: string, headers: Record<string, string>) {
    return this.request('OPTIONS', path, undefined, headers);
  }
}
