/**
 * The version of the API the app talks to, as its latest response named it
 * (`API_VERSION_HEADER`). Every API request goes through `fetchApi`, so when
 * the API is deployed while the app is open, its next answer brings the new
 * version. Null until a response has named one.
 */
import {API_VERSION_HEADER} from '@commandsnippets/api-shared/messages';
import {create} from 'zustand';

export const useApiVersion = create<{version: string | null}>()(() => ({
  version: null,
}));

/**
 * `fetch` to the API, keeping the version its response names, whatever its
 * status. A response that names none (from a proxy or gateway in front of
 * the API) leaves the last one known.
 */
export async function fetchApi(
  url: string,
  init?: RequestInit
): Promise<Response> {
  const response = await fetch(url, init);
  const version = response.headers.get(API_VERSION_HEADER);
  if (version !== null) {
    useApiVersion.setState({version});
  }
  return response;
}
