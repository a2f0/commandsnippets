import {handleUnauthorized} from '../auth/authUtils';

export async function fetchWithAuth(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, options);

  if (response.status === 403) {
    handleUnauthorized();
  }

  return response;
}
