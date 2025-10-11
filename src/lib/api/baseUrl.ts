import {environment} from '../environment';

export let baseHTTPURL: string;
if (environment === 'staging') {
  baseHTTPURL = 'https://api.staging.tearleads.com';
} else if (environment === 'production') {
  baseHTTPURL = 'https://api.tearleads.com';
} else {
  // For development, use the current hostname in browser, otherwise localhost
  const isVitest = import.meta.env?.['VITEST'];
  const hostname = !isVitest ? window.location.hostname : 'localhost';
  baseHTTPURL = `http://${hostname}:9001`;
}

export const baseURL = `${baseHTTPURL}/api/v1`;
