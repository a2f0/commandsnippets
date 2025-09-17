import {environment} from '../environment';

export let baseHTTPURL: string;
if (environment === 'staging') {
  baseHTTPURL = 'https://api.staging.tearleads.com';
} else if (environment === 'production') {
  baseHTTPURL = 'https://api.tearleads.com';
} else {
  // For development, use network IP so iOS can reach the backend
  baseHTTPURL = 'http://10.0.1.10:9001';
}

export const baseURL = `${baseHTTPURL}/api/v1`;
