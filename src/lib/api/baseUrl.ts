import {environment} from '../environment';

export let baseHTTPURL: string;
if (environment === 'staging') {
  baseHTTPURL = 'https://api.staging.tearleads.com';
} else if (environment === 'production') {
  baseHTTPURL = 'https://api.tearleads.com';
} else {
  baseHTTPURL = 'http://localhost:9001';
}

export const baseURL = `${baseHTTPURL}/api/v1`;
