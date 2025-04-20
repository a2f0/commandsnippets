import axios from 'axios';

import {environment} from '../environment';

export let baseHTTPURL: string;
if (environment === 'staging') {
  baseHTTPURL = 'https://api.staging.tearleads.com';
} else if (environment === 'production') {
  baseHTTPURL = 'https://api.tearleads.com';
} else {
  baseHTTPURL = 'http://localhost:9001';
}

const baseURL = `${baseHTTPURL}/api/v1`;

const apiBase = axios.create({
  baseURL,
  responseType: 'json',
  headers: {
    'Content-Type': 'application/vnd.api+json',
  },
});

export {apiBase};
