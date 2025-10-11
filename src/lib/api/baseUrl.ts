import {environment} from '../environment';

export let baseHTTPURL: string;
if (environment === 'staging') {
  baseHTTPURL = 'https://api.staging.tearleads.com';
} else if (environment === 'production') {
  baseHTTPURL = 'https://api.tearleads.com';
} else {
  // For development, use localhost or the current host
  // In test mode (vitest), always use localhost for MSW
  // In browser, use the current hostname (works for both localhost and network IPs)
  if (typeof import.meta !== 'undefined' && import.meta.env?.['VITEST']) {
    baseHTTPURL = 'http://localhost:9001';
  } else if (typeof window !== 'undefined') {
    // In browser, use the current hostname on port 9001
    const hostname = window.location.hostname;
    baseHTTPURL = `http://${hostname}:9001`;
  } else {
    // Fallback for SSR or other environments
    baseHTTPURL = 'http://localhost:9001';
  }
}

export const baseURL = `${baseHTTPURL}/api/v1`;
