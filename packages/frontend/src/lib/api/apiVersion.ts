/**
 * The version of the API the app talks to, as its latest response named it
 * (`API_VERSION_HEADER`). Every API request goes through `fetchApi`, so when
 * the API is deployed while the app is open, its next answer brings the new
 * version. Null until a response has named one.
 *
 * `fetchApi` also times each request for the HUD (`lib/metrics/`), from
 * when it is sent to the end of its body (read from a copy, so the caller
 * still reads the body).
 */
import {API_VERSION_HEADER} from '@commandsnippets/api-shared/messages';
import {create} from 'zustand';
import {recordTiming} from '../metrics/timings';

export const useApiVersion = create<{version: string | null}>()(() => ({
  version: null,
}));

/**
 * A request's name in the timings: its method and path, the API's prefix
 * left out and ids (segments with a digit, or the username after `users`)
 * as placeholders, so requests of an endpoint add up together.
 */
export function requestName(url: string, method = 'GET'): string {
  const path = new URL(url, window.location.href).pathname
    .replace(/^\/api\/v\d+/, '')
    .split('/')
    .map((segment, index, segments) =>
      segments[index - 1] === 'users'
        ? ':user'
        : /\d/.test(segment)
          ? ':id'
          : segment
    )
    .join('/');
  return `${method.toUpperCase()} ${path}`;
}

const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`;

/** Time `response` until its body is read, from `start`. */
function timeBody(name: string, start: number, response: Response): void {
  const headers = performance.now();
  const detail = `${response.status}, headers in ${Math.round(headers - start)} ms`;
  let copy: Response;
  try {
    copy = response.clone();
  } catch {
    // The body is read already (a test's response, used again).
    recordTiming('network', name, start, headers, detail);
    return;
  }
  copy.arrayBuffer().then(
    body =>
      recordTiming(
        'network',
        name,
        start,
        performance.now(),
        `${detail}, ${formatBytes(body.byteLength)}`
      ),
    () => recordTiming('network', name, start, performance.now(), detail)
  );
}

/**
 * `fetch` to the API, keeping the version its response names, whatever its
 * status. A response that names none (from a proxy or gateway in front of
 * the API) leaves the last one known.
 */
export async function fetchApi(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const start = performance.now();
  const name = requestName(url, init?.method);
  let response: Response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    recordTiming('network', name, start, performance.now(), 'failed');
    throw error;
  }
  timeBody(name, start, response);
  const version = response.headers.get(API_VERSION_HEADER);
  if (version !== null) {
    useApiVersion.setState({version});
  }
  return response;
}
